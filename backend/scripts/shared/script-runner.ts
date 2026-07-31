import { ScriptError, ScriptExitCode } from './script-error';
import { ScriptLogger } from './script-logger';

export interface ScriptContext {
  logger: ScriptLogger;
  startedAt: number;
}

export interface RunScriptOptions {
  name: string;
  execute: (context: ScriptContext) => Promise<void>;
  cleanup?: () => Promise<void>;
}

export async function runScript(options: RunScriptOptions): Promise<void> {
  const logger = new ScriptLogger(options.name);
  const startedAt = Date.now();

  logger.info('started', {
    nodeEnv: process.env.NODE_ENV ?? 'undefined',
  });

  try {
    await options.execute({
      logger,
      startedAt,
    });

    logger.info('completed', {
      durationMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    if (error instanceof ScriptError) {
      logger.error(error.message);
      process.exitCode = error.exitCode;
    } else {
      logger.error('unexpected failure', error);
      process.exitCode = ScriptExitCode.EXECUTION_ERROR;
    }
  } finally {
    try {
      await options.cleanup?.();
    } catch (cleanupError: unknown) {
      logger.error('cleanup failed', cleanupError);

      if (!process.exitCode) {
        process.exitCode = ScriptExitCode.EXECUTION_ERROR;
      }
    }
  }
}
