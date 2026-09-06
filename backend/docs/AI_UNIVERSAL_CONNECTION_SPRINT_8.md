# Universal AI Connection - Sprint 8

## Mục tiêu

Sprint 8 harden đường ra provider trước khi cho phép user nhập custom Base URL
công khai. Mọi request kiểm tra kết nối, dò model, probe capability và generate
đều đi qua cùng các giới hạn bảo mật; không có nhánh diagnostic được miễn quota.

## SSRF guard

- Chỉ chấp nhận HTTPS, cấm credential, fragment và query trên Base URL được lưu.
- Chặn localhost, hostname special-use và các dải IPv4/IPv6 private, link-local,
  loopback, documentation, multicast và reserved.
- Resolve toàn bộ địa chỉ DNS và từ chối nếu có bất kỳ địa chỉ nào không public.
- Kiểm tra lại URL và DNS ngay trước mỗi lần `fetch`; redirect luôn bị cấm.
- Query credential chỉ được ghép nội bộ sau khi Base URL đã được validate và
  không bao giờ được trả về API hoặc log.

Việc resolve lại ngay trước `fetch` thu hẹp cửa sổ DNS rebinding nhưng không phải
DNS pinning tuyệt đối. Vì vậy kết nối vào mạng riêng không được hỗ trợ trong
Sprint này; nếu cần phải thiết kế một cơ chế admin opt-in riêng.

## Credential vault và request contract

- API key được mã hóa AES-256-GCM với IV ngẫu nhiên và AAD versioned trước khi
  persist. Parser chỉ nhận envelope `v1` đúng cấu trúc, IV 12 byte và auth tag
  16 byte; dữ liệu sai hoặc khóa môi trường sai sẽ fail closed.
- `AI_API_KEY_ENCRYPTION_KEY`, nếu khai báo, phải là đúng 32 byte standard Base64.
- Custom header/query name phải qua allowlist ký tự. Header hop-by-hop, routing,
  forwarding, cookie và content-length bị từ chối; giá trị header không được có
  CR/LF.
- Lỗi transport được chuẩn hóa. Credential, bearer/basic token và query string
  bị redact trước khi một thông báo provider có thể đi ra ngoài.

## Resource limits

- Request thông thường: mặc định và hard cap 30 giây.
- Streaming: mặc định và hard cap 10 phút.
- JSON, error body, model discovery và toàn bộ SSE stream: tối đa 2 MiB.
- Redirect không được follow.

Override timeout từ connection không thể nâng các hard cap trên.

## Rate limit

Diagnostic operation dùng chung fixed-window bucket theo tier với generate:
Với system connection, quota được tính cho admin đang thực hiện thao tác, không
bỏ qua vì owner của connection là `null`.

| Operation                          | Request cost |
| ---------------------------------- | -----------: |
| Validate khi tạo/sửa connection    |            1 |
| Test connection                    |            1 |
| Model discovery cache miss/refresh |            1 |
| Capability probe                   |            4 |

Một operation nhiều request được reserve bằng một câu lệnh PostgreSQL atomic.
Cache hit model discovery không gọi provider nên không tiêu request quota.

## Security audit

Các lifecycle event được ghi best-effort vào `AuditLog`:

- `ai.connection.created`
- `ai.connection.updated`
- `ai.connection.deleted`
- `ai.connection.tested`
- `ai.capabilities.probed`

Audit chỉ nhận metadata allowlisted như protocol, auth type, model, tên field đã
đổi và kết quả capability. API key, Base URL, request/response body, prompt và
nội dung chat/chương không thuộc contract audit. Lỗi ghi audit không làm hỏng
operation chính và không log lại payload audit.

## Kiểm thử

- Unit: SSRF IPv4/IPv6/DNS, header/query restrictions, vault tamper, timeout cap,
  response limit, error redaction, quota diagnostic và audit contract.
- Integration: atomic multi-request reservation và audit persistence không chứa
  secret/prompt.
- E2E: custom Base URL trỏ vào private network bị từ chối trước khi persist.

## Release gate

```bash
npm run test:ai:unit
npm run test:ai:integration
npm run test:ai:e2e
npm run format:check
npm run lint:check
npm run typecheck:scripts
npm run architecture:check
npm run db:validate
npm run build
```

Integration và E2E phải dùng PostgreSQL test riêng qua `TEST_DATABASE_URL`.
