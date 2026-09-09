export const TTS_GENERATION_QUEUE_PORT = Symbol.for(
  'quan-ly-truyen.modules.tts.generation-queue',
);

export interface TtsGenerationQueuePort {
  enqueue(manifestId: string): Promise<string>;
}
