# Universal AI Connection - Sprint 7

## Mục tiêu

Sprint 7 bổ sung capability probing theo `connection + model`. Core không suy
khả năng từ tên vendor và không mặc định mọi proxy compatible đều hỗ trợ toàn
bộ feature.

## Capability contract

```ts
interface AiCapabilities {
  chat: boolean;
  modelDiscovery: boolean;
  streaming: boolean;
  systemPrompt: boolean;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
}
```

Kết quả được lưu cùng model đã probe và thời điểm probe. Khi credential, Base
URL, protocol, auth hoặc default model thay đổi, capability cũ bị xóa để tránh
dùng metadata sai. Persist dùng optimistic check theo `updatedAt` để một probe
chậm không ghi đè kết quả lên connection vừa được sửa.

## Cách probe

Capability probing chỉ chạy khi user hoặc admin chủ động bấm `Dò khả năng` và
xác nhận cảnh báo chi phí. Hệ thống không tự probe khi mở trang, tạo chat hoặc
chạy worker.

- `modelDiscovery`: gọi endpoint model của adapter.
- `chat`: gửi một generation request nhỏ không có system prompt.
- `systemPrompt`: gửi request nhỏ yêu cầu trả sentinel xác định.
- `streaming`: consume một stream nhỏ và yêu cầu có cả text lẫn `DONE`.
- `tools`, `vision`, `reasoning`: chỉ bật khi metadata model trả về xác nhận rõ
  ràng; không đoán theo brand hoặc tên model.

Endpoint:

```http
POST /ai/connections/:id/capabilities/probe
POST /admin/ai/connections/:id/capabilities/probe
```

Response không chứa API key, prompt probe hoặc lỗi thô từ provider.

## Enforcement

- Gateway từ chối chat/streaming đã được xác nhận không hỗ trợ. Chat vẫn chạy
  ở chế độ giảm cấp bằng cách bỏ system prompt nếu capability này là `false`;
  translation từ chối vì system prompt là bắt buộc cho ngữ nghĩa dịch.
- Explicit fallback policy vẫn được tôn trọng: personal connection không đủ
  capability có thể chuyển sang system connection chỉ khi policy là `SYSTEM`.
- Nếu connection chưa từng probe hoặc conversation chọn model khác model đã
  probe, capability được xem là chưa biết để giữ tương thích ngược.
- Model discovery đã xác nhận không hỗ trợ sẽ trả danh sách rỗng và UI tiếp tục
  cho nhập model thủ công.

## Chi phí và giới hạn

Một lượt probe có tối đa ba generation request nhỏ ngoài model discovery và có
thể tiêu thụ credit của provider. Mỗi diagnostic request bị giới hạn 30 giây.
HTTP route có ngân sách tối đa 3 phút cho chuỗi probe tuần tự. Đây là lý do
probe không được chạy ngầm.

## Kiểm thử

- Unit test phủ probe, persist kết quả và model metadata.
- Gateway test phủ chặn feature đã xác nhận không hỗ trợ.
- Frontend HTTP test khóa endpoint chỉ được gọi qua thao tác probe rõ ràng.
- Migration thêm các cột nullable để rolling deployment không làm hỏng bản app
  cũ.
