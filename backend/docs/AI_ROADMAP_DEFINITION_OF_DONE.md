# AI roadmap — Definition of Done

Áp dụng cho Sprint 4–6. Một mục chỉ được xem là hoàn tất khi code, migration,
test và vận hành đều đáp ứng các tiêu chí dưới đây.

## Sprint 4 — Rate limit và fallback policy

- [x] Mỗi user có tier `FREE | PRO | ENTERPRISE`; giới hạn request và token được
      khai báo tập trung.
- [x] Bộ đếm theo fixed window được reserve bằng câu lệnh PostgreSQL atomic; các
      request đồng thời không thể vượt quota.
- [x] Token được reserve trước request và reconcile theo usage thực tế sau khi
      provider trả kết quả.
- [x] `fallbackPolicy` chỉ có `NONE | SYSTEM`, mặc định `NONE`.
- [x] System key chỉ được resolve và sử dụng khi policy hiện tại là `SYSTEM`.
- [x] Streaming chỉ fallback trước khi đã phát delta đầu tiên; không ghép nội
      dung từ hai provider.
- [x] User có API/UI tự chọn fallback; admin có API/UI quản lý tier và policy.
- [x] Có unit test chứng minh `NONE` không fallback và `SYSTEM` fallback đúng một
      lần.

## Sprint 5 — AI Profile và auto-translate

- [x] User profile hỗ trợ model, system prompt/phong cách, ngôn ngữ dịch mặc
      định và auto-translate.
- [x] Story profile override từng field; giá trị `null` kế thừa user profile.
- [x] API kiểm tra ownership trước khi đọc hoặc sửa story profile.
- [x] Chat dùng model/prompt từ effective user profile.
- [x] Dịch chương dùng effective story profile và explicit fallback policy.
- [x] Publish chương chỉ ghi outbox event trong transaction, không gọi provider
      đồng bộ.
- [x] Worker xử lý event idempotent thông qua unique chapter/language translation
      và tự bỏ qua khi auto-translate đang tắt.
- [x] UI account và Author Studio cho phép cấu hình các giá trị tương ứng.

## Sprint 6 — Observability và testing

- [x] Log AI là object có `event`, provider/model, capability, latency, token,
      success/error code và connection metadata.
- [x] Có event riêng cho rate-limit rejection, system fallback activation và
      auto-translation skip.
- [x] Gateway không truyền API key, system prompt, message hoặc provider error
      text vào structured log.
- [x] Log sanitizer toàn cục redact `apiKey` kể cả ở object lồng nhau.
- [x] Unit tests phủ policy resolver, rate limiter, profile inheritance,
      fallback, log contract, translation worker và outbox routing.
- [x] Integration suite phủ persistence policy/profile và atomic rate-limit race.
- [x] E2E suite phủ HTTP authentication/authorization, default `NONE`, explicit
      opt-in `SYSTEM`, và round-trip AI profile.

## Release gate

- [ ] Chạy migration trên database staging bằng `npm run db:migrate:deploy`.
- [ ] Chạy `npm run test:ai:all` với `TEST_DATABASE_URL` trỏ tới database test
      riêng; guard phải từ chối database không có tên chứa `test`.
- [ ] Chạy `npm run quality:check` cho backend và frontend.
- [ ] Smoke test staging: user `NONE` không tạo usage cho system connection; user
      `SYSTEM` tạo hai attempt khi personal provider lỗi.
- [ ] Xác nhận dashboard/log query không chứa API key, prompt hoặc nội dung
      chương/chat.
- [ ] Xác nhận worker AI và outbox dispatcher cùng chạy, retry/dead-letter được
      theo dõi.
- [ ] Rollback application trước migration là an toàn vì các bảng/cột mới chỉ
      được code Sprint 4–6 sử dụng; không xóa migration đã deploy.

## Lệnh kiểm tra

```bash
npm run test:ai:unit
npm run test:ai:integration
npm run test:ai:e2e
npm run db:validate
npm run architecture:check
npm run lint:check
npm run build
```

Integration và E2E yêu cầu PostgreSQL test đang chạy theo `TEST_DATABASE_URL`.
Không được đổi guard để chạy bộ test này trên database development/production.
