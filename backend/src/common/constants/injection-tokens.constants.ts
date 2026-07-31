/**
 * Runtime dependency-injection tokens for shared technical ports.
 *
 * Always import these exported symbol instances. Do not recreate a Symbol with
 * the same label at an injection site because it would be a different token.
 */
export const COMMON_DI_TOKENS = {
  CLOCK: Symbol.for('quan-ly-truyen.common.clock'),
  ID_GENERATOR: Symbol.for('quan-ly-truyen.common.id-generator'),
  REQUEST_CONTEXT_STORE: Symbol.for(
    'quan-ly-truyen.common.request-context-store',
  ),
  CACHE_STORE: Symbol.for('quan-ly-truyen.common.cache-store'),
  DISTRIBUTED_LOCK: Symbol.for(
    'quan-ly-truyen.common.distributed-lock',
  ),
  TRANSACTION_MANAGER: Symbol.for(
    'quan-ly-truyen.common.transaction-manager',
  ),
  EVENT_PUBLISHER: Symbol.for(
    'quan-ly-truyen.common.event-publisher',
  ),
  IDEMPOTENCY_STORE: Symbol.for(
    'quan-ly-truyen.common.idempotency-store',
  ),
  HTTP_TIMEOUT_MS: Symbol.for(
    'quan-ly-truyen.common.http-timeout-ms',
  ),
} as const;

export const CLOCK = COMMON_DI_TOKENS.CLOCK;
export const ID_GENERATOR = COMMON_DI_TOKENS.ID_GENERATOR;
export const REQUEST_CONTEXT_STORE =
  COMMON_DI_TOKENS.REQUEST_CONTEXT_STORE;
export const CACHE_STORE = COMMON_DI_TOKENS.CACHE_STORE;
export const DISTRIBUTED_LOCK = COMMON_DI_TOKENS.DISTRIBUTED_LOCK;
export const TRANSACTION_MANAGER =
  COMMON_DI_TOKENS.TRANSACTION_MANAGER;
export const EVENT_PUBLISHER = COMMON_DI_TOKENS.EVENT_PUBLISHER;
export const IDEMPOTENCY_STORE =
  COMMON_DI_TOKENS.IDEMPOTENCY_STORE;
export const COMMON_HTTP_TIMEOUT_MS =
  COMMON_DI_TOKENS.HTTP_TIMEOUT_MS;
