# Universal AI Connection - Sprint 3

## Mục tiêu

Sprint 3 biến model thành dữ liệu cấu hình độc lập với provider: backend khám
phá và cache model theo connection, còn mỗi conversation có thể cố định một
`modelId` riêng.

## Phạm vi đã hoàn thành

- `AiModelInfo` chuẩn hóa các metadata có thể có: `id`, `displayName`, context,
  output limit và các capability tùy chọn.
- `GET /api/v1/ai/connections/:connectionId/models` và endpoint admin tương
  ứng trả `AiModelInfo[]` thay vì danh sách chuỗi.
- Danh sách model được cache 10 phút với key `ai:models:{connectionId}`.
- `?refresh=true` xóa cache trước khi gọi lại provider.
- HTTP 404, 405 hoặc 501 từ model endpoint được coi là không hỗ trợ discovery
  và trả `[]`; các lỗi kết nối/xác thực khác vẫn được báo rõ.
- OpenAI-compatible/GWAI gọi `{baseUrl}/v1/models`; Anthropic và Gemini dùng
  model endpoint theo protocol tương ứng.
- `ai_conversations.model_id` lưu model được chọn khi tạo chat.
- Khi gửi message, model conversation ưu tiên hơn AI profile, default model của
  connection và protocol default.
- UI tải lại model khi đổi connection, có nút làm mới cache và cho nhập model
  thủ công khi discovery không khả dụng.

## Model resolution

```text
conversation.modelId
  -> user AI profile model (nếu đã cấu hình)
  -> connection.defaultModel
  -> protocol/system default
```

Model của conversation được dùng cho cả request thường và streaming. Khi
fallback sang system connection được người dùng cho phép, cùng model override
được giữ lại vì fallback vẫn cùng protocol.

## Kiểm thử

- Unit test xác nhận cache hit, cache miss TTL 600 giây, refresh invalidation và
  protocol không hỗ trợ discovery.
- Prisma schema/migration validation xác nhận cột `model_id` mới.
- Backend AI unit suite, backend full unit suite, frontend typecheck/lint/test và
  production build đều phải qua trước khi bàn giao.

## Ngoài phạm vi Sprint 3

Capability-aware routing, đổi model giữa một conversation đang chạy và
Responses API streaming thuộc các sprint sau.
