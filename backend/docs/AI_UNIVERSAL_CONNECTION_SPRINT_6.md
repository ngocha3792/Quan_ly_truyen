# Universal AI Connection - Sprint 6

## Mục tiêu

Sprint 6 chuẩn hóa streaming của mọi protocol thành một contract nội bộ duy
nhất. Gateway và frontend không cần biết stream đến từ OpenAI Responses,
OpenAI-compatible, Anthropic hay Gemini.

## Contract chuẩn hóa

```ts
type AiStreamEvent =
  | { type: 'TEXT_DELTA'; text: string }
  | { type: 'USAGE'; usage: AiUsage }
  | { type: 'DONE' };
```

- Adapter chịu trách nhiệm chuyển event riêng của provider sang contract trên.
- Gateway phát `DONE` đúng một lần, sau khi đã reconcile quota và ghi usage.
- Handler chỉ persist assistant message khi nội dung stream không rỗng.
- SSE endpoint gửi heartbeat mỗi 15 giây để giữ kết nối qua proxy.

Public SSE giữ trường `type: delta | done | error` trong giai đoạn rolling
deployment và bổ sung trường `event: TEXT_DELTA | USAGE | DONE | ERROR`.
Frontend ưu tiên contract mới nhưng vẫn đọc được payload cũ, tránh làm gián
đoạn client đang mở khi backend được deploy trước.

## Giới hạn generation

- Input tối đa: 10.000 token ước lượng, áp dụng tập trung cho cả chat và
  translation worker. Chat tự bỏ lịch sử cũ trước khi vượt ngân sách.
- Output mặc định và tối đa: 10.000 token cho mọi adapter. Caller có thể chỉ
  định ngân sách thấp hơn cho một use case cụ thể.
- Provider stream và HTTP SSE được phép chạy tối đa 10 phút.
- Request không streaming vẫn giữ timeout ngắn 30 giây.

## Kiểm thử

- Adapter tests phủ chuẩn hóa delta, usage, done và CRLF SSE.
- Gateway test bảo đảm usage được ghi và chỉ có một `DONE`.
- Handler test phủ persist message sau stream.
- Controller test khóa timeout SSE ở 600.000 ms.
- Frontend parser test phủ payload mới, payload legacy và dữ liệu sai contract.
- Token-budget/rate-limit tests khóa input và output mặc định ở 10.000 token.

## Ngoài phạm vi

Capability probing và auto-detect protocol thuộc Sprint 7. WebSocket chưa cần
thêm vì SSE đã đáp ứng luồng một chiều provider-to-client hiện tại.
