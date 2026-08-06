import { ProfileCompletion } from '../domain/account-profile.models';

export const MOCK_PROFILE_COMPLETION: ProfileCompletion = {
  percent: 80,
  message: 'Tài khoản đã hoàn thiện 80%',
  items: [
    { label: 'Xác thực Email', description: 'Đã xác thực email chính thức', completed: true },
    { label: 'Cập nhật Tên hiển thị', description: 'Đã thiết lập nickname', completed: true },
    { label: 'Cập nhật Ảnh đại diện', description: 'Đã tải lên avatar cá nhân', completed: true },
    { label: 'Viết Giới thiệu (Bio)', description: 'Thêm vài dòng giới thiệu bản thân', completed: false },
  ],
};
