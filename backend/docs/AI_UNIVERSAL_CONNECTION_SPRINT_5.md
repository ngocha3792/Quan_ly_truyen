# Universal AI Connection - Sprint 5

## Mục tiêu

Sprint 5 hoàn thiện Connection Manager cho cả kết nối cá nhân và kết nối hệ
thống. UI quản lý connection theo preset/protocol, không chọn adapter theo tên
thương hiệu.

## Chức năng

- Thêm, sửa, xóa và bật/tắt connection.
- Test connection theo protocol đã lưu.
- Discover models qua endpoint `GET /ai/connections/:id/models` tương ứng của
  user hoặc admin.
- Refresh models với `refresh=true` để bỏ qua cache Sprint 3.
- Chọn một model discovery được làm `defaultModel` của connection.
- Khi gateway không hỗ trợ discovery, UI vẫn cho nhập model thủ công khi sửa.

## Advanced connection

Preset `CUSTOM` yêu cầu user/admin chọn rõ ràng:

- HTTPS Base URL.
- Protocol được hỗ trợ.
- Auth type.
- Tên header/query parameter khi auth strategy yêu cầu.
- Model mặc định.

Backend không auto-detect protocol trong Sprint 5 vì probe có thể làm phát sinh
request hoặc chi phí ngoài ý muốn.

Khi đổi protocol của custom connection, backend dùng adapter mới để test cấu
hình trước khi persist và đồng bộ transitional legacy provider mirror.

## Kiểm thử

- Preset tests phủ custom protocol và validation bắt buộc.
- Update handler test bảo đảm protocol mới chọn đúng adapter trước khi lưu.
- Frontend HTTP test phủ custom payload và model refresh query/metadata.

## Ngoài phạm vi

Chuẩn hóa public stream event thuộc Sprint 6; capability probing thuộc Sprint
7; auto-detect protocol vẫn để sau vì có thể tiêu thụ credit.
