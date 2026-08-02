export const PASSWORD_HASHER_PORT = Symbol('AUTH_PASSWORD_HASHER_PORT');

export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;

  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}
