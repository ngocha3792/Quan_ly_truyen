import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import type { ApiSuccessEnvelope } from '../http/api-envelope.model';

export interface TtsReadableBlock {
  readonly id: string | null;
  readonly type: string;
  readonly text: string;
}

export interface TtsConnection {
  readonly id: string;
  readonly name: string;
  readonly voiceId: string;
  readonly voiceName: string;
  readonly language: string;
  readonly isSystem: boolean;
}

interface TtsSegment {
  readonly blockId: string;
  readonly audioUrl: string | null;
}

interface TtsManifest {
  readonly id: string;
  readonly status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  readonly failureReason: string | null;
  readonly segments?: readonly TtsSegment[];
}

interface TtsQuota {
  readonly remainingCharacters: number;
  readonly monthlyCharacterLimit: number;
}

@Injectable()
export class TtsReaderService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly destroyRef = inject(DestroyRef);
  private blocks: readonly TtsReadableBlock[] = [];
  private currentIndex = 0;
  private audio: HTMLAudioElement | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private generationSequence = 0;

  readonly voices = signal<readonly SpeechSynthesisVoice[]>([]);
  readonly connections = signal<readonly TtsConnection[]>([]);
  readonly quota = signal<TtsQuota | null>(null);
  readonly activeBlockId = signal<string | null>(null);
  readonly state = signal<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  readonly message = signal<string | null>(null);
  readonly supported = computed(() => this.browser && 'speechSynthesis' in window);

  constructor() {
    if (this.supported()) {
      this.refreshVoices();
      window.speechSynthesis.addEventListener('voiceschanged', this.refreshVoices);
    }
    this.destroyRef.onDestroy(() => {
      this.stop();
      if (this.supported())
        window.speechSynthesis.removeEventListener('voiceschanged', this.refreshVoices);
    });
  }

  setBlocks(blocks: readonly TtsReadableBlock[]): void {
    this.blocks = blocks.filter(
      (block) => block.id && block.text.trim() && block.type !== 'horizontal_rule',
    );
  }

  playBrowser(voiceUri: string, rate: number): void {
    if (!this.supported() || !this.blocks.length) return;
    this.stop();
    this.currentIndex = 0;
    this.speakCurrent(voiceUri, rate);
  }

  togglePause(): void {
    if (this.audio) {
      if (this.audio.paused) void this.audio.play();
      else this.audio.pause();
      this.state.set(this.audio.paused ? 'paused' : 'playing');
      return;
    }
    if (!this.supported()) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.state.set('playing');
    } else {
      window.speechSynthesis.pause();
      this.state.set('paused');
    }
  }

  stop(): void {
    this.generationSequence += 1;
    if (this.supported()) window.speechSynthesis.cancel();
    this.audio?.pause();
    this.audio = null;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.activeBlockId.set(null);
    this.clearActiveBlock();
    this.state.set('idle');
  }

  async loadProviderOptions(): Promise<void> {
    if (!this.config.features.textToSpeechEnabled) return;
    try {
      const [connections, quota] = await Promise.all([
        this.get<readonly TtsConnection[]>('/tts/connections'),
        this.get<TtsQuota>('/tts/quota'),
      ]);
      this.connections.set(connections);
      this.quota.set(quota);
    } catch (error) {
      this.message.set(apiMessage(error, 'Đăng nhập để dùng giọng đọc provider.'));
    }
  }

  async generate(
    chapterId: string,
    connectionId: string,
    language: string,
    rate: number,
    fallbackPolicy: 'NONE' | 'SYSTEM',
  ): Promise<void> {
    this.stop();
    const generation = this.generationSequence;
    this.state.set('loading');
    this.message.set('Đang chuẩn bị audio...');
    try {
      const manifest = await this.post<TtsManifest>('/tts/manifests', {
        chapterId,
        connectionId,
        language,
        fallbackPolicy,
      });
      await this.waitForManifest(manifest.id, rate, generation);
    } catch (error) {
      this.state.set('error');
      this.message.set(apiMessage(error, 'Không thể tạo audio.'));
    }
  }

  private readonly refreshVoices = (): void => {
    if (!this.supported()) return;
    this.voices.set(
      [...window.speechSynthesis.getVoices()].sort((a, b) => a.lang.localeCompare(b.lang)),
    );
  };

  private speakCurrent(voiceUri: string, rate: number): void {
    const block = this.blocks[this.currentIndex];
    if (!block) {
      this.stop();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(block.text);
    utterance.rate = rate;
    utterance.voice = this.voices().find((voice) => voice.voiceURI === voiceUri) ?? null;
    utterance.lang = utterance.voice?.lang ?? 'vi-VN';
    utterance.onstart = () => this.activate(block.id);
    utterance.onend = () => {
      this.currentIndex += 1;
      this.speakCurrent(voiceUri, rate);
    };
    utterance.onerror = () => {
      this.state.set('error');
      this.message.set('Trình duyệt không thể phát giọng đọc đã chọn.');
    };
    window.speechSynthesis.speak(utterance);
  }

  private async waitForManifest(
    manifestId: string,
    rate: number,
    generation: number,
  ): Promise<void> {
    if (generation !== this.generationSequence) return;
    const manifest = await this.get<TtsManifest>(`/tts/manifests/${manifestId}`);
    if (generation !== this.generationSequence) return;
    if (manifest.status === 'FAILED')
      throw new Error(manifest.failureReason ?? 'Tạo audio thất bại');
    if (manifest.status === 'COMPLETED') {
      await this.playSegments(
        (manifest.segments ?? []).filter((segment) => segment.audioUrl),
        rate,
        0,
      );
      void this.loadProviderOptions();
      return;
    }
    await new Promise<void>((resolve) => {
      this.pollTimer = setTimeout(resolve, 1_500);
    });
    return this.waitForManifest(manifestId, rate, generation);
  }

  private async playSegments(
    segments: readonly TtsSegment[],
    rate: number,
    index: number,
  ): Promise<void> {
    const segment = segments[index];
    if (!this.browser || !segment?.audioUrl) {
      this.stop();
      return;
    }
    const audio = new Audio(segment.audioUrl);
    this.audio = audio;
    audio.playbackRate = rate;
    audio.onplay = () => this.activate(segment.blockId);
    audio.onended = () => void this.playSegments(segments, rate, index + 1);
    audio.onerror = () => {
      this.state.set('error');
      this.message.set('Không thể phát segment audio.');
    };
    await audio.play();
  }

  private activate(blockId: string | null): void {
    this.state.set('playing');
    this.message.set(null);
    this.activeBlockId.set(blockId);
    if (blockId && this.browser) {
      this.clearActiveBlock();
      const element = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
      element?.classList.add('tts-active');
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private clearActiveBlock(): void {
    if (!this.browser) return;
    document
      .querySelector<HTMLElement>('[data-block-id].tts-active')
      ?.classList.remove('tts-active');
  }

  private async get<T>(path: string): Promise<T> {
    return (
      await firstValueFrom(this.http.get<ApiSuccessEnvelope<T>>(`${this.config.apiBaseUrl}${path}`))
    ).data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return (
      await firstValueFrom(
        this.http.post<ApiSuccessEnvelope<T>>(`${this.config.apiBaseUrl}${path}`, body, {
          headers,
        }),
      )
    ).data;
  }
}

function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.error?.message === 'string')
    return error.error.error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
