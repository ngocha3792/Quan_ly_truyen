type LogFields = Record<string, string | number | boolean | null | undefined>;

function serializeFields(fields?: LogFields): string {
  if (!fields) {
    return '';
  }

  const values = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);

  return values.length > 0 ? ` ${values.join(' ')}` : '';
}

export class ScriptLogger {
  public constructor(private readonly scriptName: string) {}

  public info(message: string, fields?: LogFields): void {
    console.log(`[${this.scriptName}] ${message}${serializeFields(fields)}`);
  }

  public warn(message: string, fields?: LogFields): void {
    console.warn(
      `[${this.scriptName}] WARN ${message}${serializeFields(fields)}`,
    );
  }

  public error(message: string, error?: unknown): void {
    let detail = '';

    if (error instanceof Error) {
      detail = error.stack ?? error.message;
    } else if (typeof error === 'string') {
      detail = error;
    } else if (typeof error === 'number' || typeof error === 'boolean') {
      detail = String(error);
    } else if (error !== undefined && error !== null) {
      detail = JSON.stringify(error);
    }

    console.error(
      `[${this.scriptName}] ERROR ${message}${detail ? `\n${detail}` : ''}`,
    );
  }
}
