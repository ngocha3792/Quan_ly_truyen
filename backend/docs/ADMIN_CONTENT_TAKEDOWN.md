# Gỡ nội dung lỡ xuất bản (admin, không có giao diện)

Hai endpoint dành cho tình huống truyện hoặc chương bị xuất bản nhầm. Chúng
**không** được gắn vào bất kỳ màn hình admin nào — chỉ gọi bằng tay (curl,
Postman) khi cần. "Không có giao diện" chỉ là không hiển thị: request vẫn phải
đăng nhập, vẫn qua permission guard và vẫn ghi audit log như mọi thao tác quản
trị khác.

## Endpoint

| Method | Path | Permission (AND) |
| --- | --- | --- |
| `DELETE` | `/api/v1/admin/content-takedown/chapters/:chapterId` | `chapter.manage.any` + `moderation.execute` |
| `DELETE` | `/api/v1/admin/content-takedown/stories/:storyId` | `story.delete.any` + `moderation.execute` |

Cả hai permission đều đã có sẵn trong `PermissionCode` và role `ADMIN` được seed
toàn bộ permission, nên không cần migration hay seed mới.

### Body

```json
{
  "reason": "Lý do gỡ, 10–2000 ký tự",
  "acknowledgePurchases": false
}
```

- `reason` — bắt buộc, chuẩn hóa NFKC + gom khoảng trắng, phải dài 10–2000 ký
  tự. Lý do được ghi vào `moderation_actions.reason` và `audit_logs.metadata`.
- `acknowledgePurchases` — mặc định `false`. Xem phần chặn theo lượt mua.

Header `Idempotency-Key` là tùy chọn; nếu gửi thì kết quả được phát lại trong 24
giờ.

### Ví dụ

```bash
curl -X DELETE \
  "https://<host>/api/v1/admin/content-takedown/chapters/<chapterId>" \
  -H "Authorization: Bearer <admin access token>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Xuất bản nhầm bản thảo chưa biên tập"}'
```

## "Xóa" ở đây là soft delete

Cả hai endpoint đặt `deleted_at` chứ không xóa hàng khỏi bảng:

- `chapter_purchases` và `chapter_entitlements` tham chiếu `chapters` với
  `onDelete: Restrict`, nên một chương đã có người mua **không thể** xóa vật lý
  mà không phá sổ ví.
- Toàn bộ phần đọc đã lọc theo `deletedAt: null`, nên nội dung biến mất khỏi
  reader, danh sách chương và trang truyện ngay lập tức.
- Dữ liệu vẫn còn để đối soát doanh thu và để khôi phục bằng SQL nếu gỡ nhầm
  (`UPDATE chapters SET deleted_at = NULL WHERE id = ...`), nhớ hoàn lại
  `stories.chapter_count` và `author_profiles.story_count` tương ứng.

## Chặn theo lượt mua

Trước khi gỡ, hệ thống đếm `chapter_purchases` ở trạng thái `COMPLETED` (của
chương, hoặc của mọi chương thuộc truyện). Nếu số đó lớn hơn 0 mà
`acknowledgePurchases` không phải `true`, request bị từ chối:

```
409 CONTENT_TAKEDOWN_PURCHASES_EXIST
{ "details": { "purchaseCount": 7 } }
```

Gửi lại với `"acknowledgePurchases": true` nếu vẫn muốn gỡ. Mục đích là không
để admin âm thầm cắt quyền đọc của người đã trả tiền — hoàn tiền vẫn phải làm
riêng qua luồng refund.

## Hiệu ứng phụ được xử lý

Gỡ **chương**:

- đặt `deleted_at`, `updated_by_id`, `updated_at`;
- nếu chương đang `PUBLISHED`: giảm `stories.chapter_count` một đơn vị (vì
  counter này chỉ tăng lúc xuất bản) và tính lại `stories.last_chapter_at` từ
  các chương còn sống, để truyện không trỏ vào chương vừa gỡ;
- ghi `moderation_actions` (`HIDE_CHAPTER`) và `audit_logs`
  (`chapter.admin.taken_down`).

Gỡ **truyện**:

- soft delete mọi chương còn sống của truyện;
- đặt `deleted_at`, xóa `cover_media_id`, tăng `version`;
- giảm `author_profiles.story_count`;
- ghi `moderation_actions` (`SUSPEND_STORY`) và `audit_logs`
  (`story.admin.taken_down`).

Cả hai chạy trong một transaction và khóa hàng theo thứ tự story → chapter
giống các luồng ghi khác, nên không kẹt khóa chéo với thao tác xuất bản.

## Mã lỗi

| HTTP | Code | Khi nào |
| --- | --- | --- |
| 400 | `CONTENT_TAKEDOWN_REASON_REQUIRED` | `reason` ngắn hơn 10 hoặc dài hơn 2000 ký tự |
| 401 | `AUTHENTICATION_REQUIRED` | Thiếu hoặc sai access token |
| 403 | — | Thiếu một trong hai permission |
| 404 | `CHAPTER_NOT_FOUND` / `STORY_NOT_FOUND` | Không tồn tại, hoặc đã bị gỡ trước đó |
| 409 | `CONTENT_TAKEDOWN_PURCHASES_EXIST` | Đã có lượt mua mà chưa xác nhận |
