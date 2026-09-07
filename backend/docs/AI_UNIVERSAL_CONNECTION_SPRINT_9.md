# Universal AI Connection - Sprint 9

## Mục tiêu

Sprint 9 mở read-side cho dữ liệu `AiUsage` đã được gateway ghi ở từng provider
attempt. User xem dữ liệu của chính mình; admin có thể xem toàn hệ thống hoặc
lọc theo `userId`.

## API

```http
GET /ai/usage?from=2026-09-01&to=2026-09-07
GET /admin/ai/usage?from=2026-09-01&to=2026-09-07&userId=<uuid>
```

- `from` và `to` dùng ngày UTC, tính cả hai đầu.
- Mặc định là 30 ngày gần nhất; tối đa 365 ngày.
- User endpoint luôn khóa scope theo identity trong access token.
- Admin endpoint yêu cầu `AI_SETTINGS_MANAGE`; bỏ `userId` để xem aggregate toàn
  hệ thống.

Response gồm totals, top 50 model, top 50 connection và các metric:

- provider attempts, thành công và thất bại;
- input/output/total token;
- average latency;
- error rate theo phần trăm.

Một user request có fallback có thể tạo hai provider attempt. Vì vậy `requests`
trong usage có thể khác số request quota đã dùng.

## Quota snapshot

User response và admin response có lọc `userId` trả thêm fixed-window quota hiện
tại: tier, thời điểm reset, request/token đã dùng, giới hạn và phần còn lại.
Snapshot đọc cùng bucket mà Sprint 4 dùng để enforce quota, không tự cộng lại từ
usage history.

## Token integrity

Gateway chỉ persist token là số nguyên từ 0 đến giới hạn PostgreSQL `INTEGER`.
Provider trả token âm, thập phân, vô hạn hoặc quá lớn sẽ được xem là không có
usage metadata; rate-limit reconciliation quay về ước lượng bảo thủ.

## Pricing

Pricing là optional và hiện trả rõ:

```json
{
  "status": "NOT_CONFIGURED",
  "currency": "USD",
  "estimatedCost": null
}
```

Hệ thống không đoán giá từ vendor hint hoặc tên model. Với custom gateway, cùng
một model ID có thể có bảng giá khác nhau; muốn bật cost phải bổ sung price book
versioned theo `connection + model` và lưu snapshot giá tại thời điểm gọi.

## Database

Migration `20260907010000_add_ai_usage_read_indexes` thêm index theo thời gian,
connection và model. Không thay đổi hoặc backfill row usage hiện có.

## Kiểm thử

- Unit test aggregate token, latency, error rate, quota và date-range guard.
- Integration test ghi row thật rồi aggregate theo model trong PostgreSQL.
- E2E test authorization và response contract của user usage endpoint.
- Frontend HTTP test khóa route/date query cho user và admin.
