import { spawn } from 'node:child_process';

import { ScriptError, ScriptExitCode } from './script-error';

export interface RunCommandOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    child.once('error', reject);

    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new ScriptError(
          `Command failed: ${options.command} ${options.args.join(' ')} ` +
            `(code=${String(code)}, signal=${String(signal)})`,
          ScriptExitCode.EXECUTION_ERROR,
        ),
      );
    });
  });
}
