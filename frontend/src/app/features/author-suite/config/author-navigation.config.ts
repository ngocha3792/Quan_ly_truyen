import { WorkspaceNavigationItem } from '../../../layouts/workspace-layout/workspace-layout.component';

export const AUTHOR_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  { label: 'Tổng quan', route: '/author', icon: '▦', exact: true },
  { label: 'Truyện của tôi', route: '/author/stories', icon: '▤' },
  { label: 'Quản lý chương', route: '/author/stories/1/chapters', icon: '☷' },
  { label: 'Tạo truyện', route: '/author/stories/new', icon: '✎' },
  { label: 'Thống kê', route: '/author/analytics', icon: '⌁' },
  { label: 'Doanh thu', route: '/author/revenue', icon: '₫' },
  { label: 'Tin nhắn', route: '/author/messages', icon: '✉' },
  { label: 'Thông báo', route: '/author/notifications', icon: '♢' },
  { label: 'Hồ sơ tác giả', route: '/author/profile', icon: '◉' },
  { label: 'Cài đặt', route: '/author/settings', icon: '⚙' },
  { label: 'Hỗ trợ', route: '/author/support', icon: '?' },
  { label: 'Cộng đồng', route: '/author/community', icon: '♧' },
];
