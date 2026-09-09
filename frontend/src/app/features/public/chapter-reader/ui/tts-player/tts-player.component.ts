import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TtsReaderService } from '../../../../../core/tts/tts-reader.service';
import type { ChapterContentBlock } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-tts-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tts-player.component.html',
  styleUrl: './tts-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TtsReaderService],
})
export class TtsPlayerComponent implements OnInit, OnChanges {
  @Input({ required: true }) chapterId = '';
  @Input({ required: true }) blocks: readonly ChapterContentBlock[] = [];
  @Input() offline = false;

  protected readonly tts = inject(TtsReaderService);
  protected mode: 'browser' | 'provider' = 'browser';
  protected voiceUri = '';
  protected connectionId = '';
  protected rate = 1;
  protected allowSystemFallback = false;

  ngOnInit(): void {
    void this.tts.loadProviderOptions();
  }

  ngOnChanges(): void {
    this.tts.stop();
    this.tts.setBlocks(this.blocks);
  }

  protected play(): void {
    if (this.mode === 'browser') {
      this.voiceUri ||=
        this.tts.voices().find((voice) => voice.lang.startsWith('vi'))?.voiceURI ??
        this.tts.voices()[0]?.voiceURI ??
        '';
      this.tts.playBrowser(this.voiceUri, this.rate);
      return;
    }
    const connection = this.tts.connections().find((item) => item.id === this.connectionId);
    if (connection) {
      void this.tts.generate(
        this.chapterId,
        connection.id,
        connection.language,
        this.rate,
        connection.isSystem || this.allowSystemFallback ? 'SYSTEM' : 'NONE',
      );
    }
  }

  protected selectedConnectionIsSystem(): boolean {
    return this.tts
      .connections()
      .some((connection) => connection.id === this.connectionId && connection.isSystem);
  }
}
