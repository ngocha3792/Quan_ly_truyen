export enum ScriptExitCode {
  SUCCESS = 0,
  EXECUTION_ERROR = 1,
  INVALID_ARGUMENT = 2,
  SAFETY_GUARD = 3,
  INTEGRITY_FAILURE = 4,
  DIFFERENCE_FOUND = 5,
}

export class ScriptError extends Error {
  public constructor(
    message: string,
    public readonly exitCode: ScriptExitCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ScriptError';
  }
}
