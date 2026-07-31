export class InvalidMailJobException extends Error {
  constructor(message: string) {
    super(message);
    this.name = InvalidMailJobException.name;
  }
}
