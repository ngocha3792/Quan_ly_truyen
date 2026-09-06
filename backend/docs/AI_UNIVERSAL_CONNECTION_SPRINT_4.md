# Universal AI Connection - Sprint 4

## Mục tiêu

Sprint 4 hoàn thiện hai protocol native còn lại của lớp kết nối AI:
`OPENAI_RESPONSES` và `GEMINI_GENERATE_CONTENT`. Business layer tiếp tục chỉ
gọi `AiGateway`; protocol registry quyết định adapter.

## OpenAI Responses

- Preset OpenAI official dùng `OPENAI_RESPONSES` tại
  `https://api.openai.com/v1`.
- Adapter gọi `POST /v1/responses` với `model`, `instructions`, `input`,
  `max_output_tokens`, `stream` và `store: false`.
- Non-stream ưu tiên `output_text`, sau đó chỉ ghép các content block có type
  `output_text`; reasoning, tool call và refusal không bị đưa vào nội dung chat.
- Stream chỉ phát text từ `response.output_text.delta` và usage từ
  `response.completed`/`response.incomplete`.
- Model discovery tiếp tục dùng `GET /v1/models` và cache của Sprint 3.

Contract được đối chiếu với tài liệu chính thức:
https://developers.openai.com/api/reference/cli/resources/responses/methods/create

## Gemini Generate Content

- Preset Gemini dùng `GEMINI_GENERATE_CONTENT` và query auth `key`.
- Adapter gọi `models/{model}:generateContent` cho request thường và
  `models/{model}:streamGenerateContent?alt=sse` cho stream.
- `systemPrompt` được normalize thành `systemInstruction`; role assistant được
  map thành role `model`.
- Text từ các candidate parts và token usage được normalize về response chung.
- Model discovery giữ metadata display name, input limit và output limit.

## Migration

Migration `20260906160000_enable_native_ai_protocols` chuyển connection và
conversation của preset OpenAI official từ Chat Completions sang Responses.
Các connection `OPENAI_COMPATIBLE` vẫn giữ nguyên
`OPENAI_CHAT_COMPLETIONS`.

## Kiểm thử

- Registry dispatch đúng bốn protocol.
- Preset OpenAI official chọn Responses, preset compatible vẫn chọn Chat
  Completions.
- Contract tests kiểm tra URL, auth, request body, output filtering, streaming
  events và usage cho OpenAI Responses.
- Contract test Gemini kiểm tra URL native, query auth, system instruction,
  response text và usage.
- SSRF test phủ thêm Responses adapter.

## Ngoài phạm vi Sprint 4

Connection Manager UI đầy đủ thuộc Sprint 5; chuẩn hóa stream event công khai
thuộc Sprint 6; capability probing thuộc Sprint 7.
