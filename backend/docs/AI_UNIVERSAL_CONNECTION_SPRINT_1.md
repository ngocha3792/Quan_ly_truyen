# Universal AI Connection Layer — Sprint 1

## Mục tiêu

Sprint 1 chuyển lõi AI từ định tuyến theo brand/provider sang định tuyến theo
protocol. Business layer chỉ làm việc với connection đã resolve:

```ts
aiGateway.generate(connection, request);
```

`vendorHint` chỉ là metadata phục vụ UI và tương thích API cũ. Nó không được
dùng để chọn adapter.

## Domain contract

`AiConnection` chứa các thuộc tính generic:

- `protocol`: `OPENAI_RESPONSES`, `OPENAI_CHAT_COMPLETIONS`,
  `ANTHROPIC_MESSAGES`, hoặc `GEMINI_GENERATE_CONTENT`.
- `baseUrl`: endpoint của official API hoặc proxy.
- `authType`: `BEARER`, `X_API_KEY`, `API_KEY_HEADER`, hoặc `QUERY_PARAM`.
- `authHeaderName`: tên header/query parameter khi auth type cần cấu hình.
- `encryptedCredential`: credential đã mã hóa ở persistence boundary.
- `defaultModel`: model mặc định của connection.
- `vendorHint`: nhãn tùy chọn, không tham gia routing.

`AiResolvedConnectionFactory` là nơi duy nhất giải mã credential và resolve
model trước khi gọi gateway.

## Routing

`AiProtocolRegistry` ánh xạ protocol sang đúng một adapter:

| Protocol | Adapter |
| --- | --- |
| `OPENAI_CHAT_COMPLETIONS` | `OpenAiChatCompletionsProtocolAdapter` |
| `ANTHROPIC_MESSAGES` | `AnthropicMessagesProtocolAdapter` |
| `GEMINI_GENERATE_CONTENT` | `GeminiGenerateContentProtocolAdapter` |
| `OPENAI_RESPONSES` | Được nhận diện nhưng chưa hỗ trợ trong Sprint 1 |

OpenAI official và mọi OpenAI-compatible proxy cùng dùng một protocol adapter;
không tạo adapter riêng theo brand.

## Compatibility và migration

Migration dùng chiến lược expand/contract để rolling deploy an toàn:

1. Thêm và backfill các cột protocol/auth/credential mới.
2. Code mới đọc cột mới và fallback sang cột legacy khi cần.
3. Code mới dual-write `provider` và `encrypted_api_key` để instance cũ vẫn chạy.
4. Giữ index provider trong expand phase.
5. Chỉ xóa cột/index legacy bằng contract migration ở release sau khi toàn bộ
   instance đã chạy code mới.

Request/response HTTP cũ vẫn giữ trường `provider` như một preset compatibility
boundary để frontend hiện tại không bị breaking change. Preset được chuyển thành
`protocol + auth + baseUrl` ngay tại presentation layer.

## Error và observability

Adapter trả `AiProtocolRequestError`; gateway chuẩn hóa thành error domain chung,
bao gồm credential, model, rate limit, credit, context, timeout và upstream
availability. Structured log dùng event `ai.protocol-attempt.completed` và chỉ
ghi metadata vận hành; credential, prompt, message và upstream error body không
được ghi log.

## Sprint 1 Definition of Done

- Business/application layer không định tuyến bằng provider.
- Gateway dispatch hoàn toàn bằng `connection.protocol`.
- Request, response, stream delta và protocol error có contract chung.
- Bốn auth type được áp dụng từ connection và header nguy hiểm bị chặn.
- Connection cũ được backfill; code mới tương thích rolling deploy.
- Fallback system vẫn chỉ chạy khi execution plan đã cho phép rõ ràng.
- Unit test phủ protocol dispatch, auth strategy, fallback và secret-safe logs.
- Prisma schema/migration, architecture check, typecheck, lint và build đều pass.

## Cố ý chưa làm trong Sprint 1

- OpenAI Responses adapter.
- Advanced connection manager UI.
- Model cache và model gắn trực tiếp vào conversation.
- Capability probing, pricing và auto-detect protocol.
- Contract migration xóa các cột provider legacy.
