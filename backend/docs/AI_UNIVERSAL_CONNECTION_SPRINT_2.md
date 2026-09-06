# Universal AI Connection - Sprint 2

## Mục tiêu

Sprint 2 mở kết nối tới API tương thích mà không tạo adapter theo từng thương
hiệu. Backend chọn adapter bằng `protocol`; `provider` ở HTTP/UI chỉ còn là
preset giúp người dùng cấu hình dễ hơn.

## Phạm vi đã hoàn thành

- `OPENAI_COMPATIBLE` dùng protocol `OPENAI_CHAT_COMPLETIONS`.
- `ANTHROPIC_COMPATIBLE` dùng protocol `ANTHROPIC_MESSAGES`.
- Cho phép cấu hình `baseUrl`, credential, `authType` và tên header/query tùy
  chỉnh trên API quản trị và API người dùng.
- UI tạo/sửa connection hỗ trợ hai preset compatible và các kiểu auth:
  `BEARER`, `X_API_KEY`, `API_KEY_HEADER`, `QUERY_PARAM`.
- Khi đổi URL, credential hoặc auth, connection được kiểm tra lại trước khi lưu.
- Base URL chỉ nhập origin sẽ tự thêm version path (`/v1`). Nếu gateway đã có
  path riêng thì giữ nguyên path đó.
- Anthropic response chỉ ghép các block `text`; block `thinking` không được đưa
  vào nội dung chat/editor.

## Contract GWAI đã kiểm thử

Fixture contract dùng cấu hình sau (không chứa credential thật):

```text
baseUrl: https://1gw.gwai.cloud
protocol: ANTHROPIC_MESSAGES
authType: X_API_KEY
authHeaderName: x-api-key
model: claude-sonnet-5
```

Adapter tạo request:

```text
POST https://1gw.gwai.cloud/v1/messages
x-api-key: <credential>
anthropic-version: 2023-06-01
```

Test mock xác nhận URL, headers, model, `max_tokens`, token usage và việc loại
block `thinking`. Đây là contract test cục bộ; kiểm thử live cần credential GWAI
hợp lệ và chủ động tiêu tốn credit nên không chạy trong CI.

## An toàn

- Credential tiếp tục được mã hóa khi lưu và không trả về API.
- Custom URL bắt buộc HTTPS, DNS public, không trỏ private/loopback/link-local.
- Không theo redirect và giới hạn response body.
- Từ chối URL chứa username/password, query string hoặc fragment; auth query
  param chỉ được adapter gắn sau khi URL đã qua kiểm tra.

## Ngoài phạm vi Sprint 2

Model discovery API, cache model và model theo conversation thuộc Sprint 3.
Không có adapter `GWAI`, `DeepSeek` hay adapter theo brand; các gateway này dùng
adapter theo protocol mà chúng công bố.
