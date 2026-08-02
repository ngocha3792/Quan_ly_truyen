export const ID_GENERATOR_PORT = Symbol('AUTH_ID_GENERATOR_PORT');

export interface IdGeneratorPort {
  generate(): string;
}
