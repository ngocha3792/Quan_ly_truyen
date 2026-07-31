import { ScriptError, ScriptExitCode } from './script-error';

export function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

export function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;

  const match = process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix));

  return match?.slice(prefix.length);
}

export function requireArgument(name: string): string {
  const value = readArgument(name)?.trim();

  if (!value) {
    throw new ScriptError(
      `Missing required argument --${name}=<value>`,
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  return value;
}

export function readPositiveInteger(
  name: string,
  defaultValue: number,
): number {
  const raw = readArgument(name);

  if (raw === undefined) {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ScriptError(
      `--${name} must be a positive integer`,
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  return value;
}
