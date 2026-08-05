import { WorkspaceNavigationItem } from '../../../layouts/workspace-layout/workspace-layout.component';

export const ADMIN_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: '▦', exact: true },
  { label: 'Quản lý truyện', route: '/admin/stories', icon: '▤' },
  { label: 'Quản lý chương', route: '/admin/stories/1/chapters', icon: '☷' },
  { label: 'Người dùng', route: '/admin/users', icon: '♙' },
  { label: 'Tác giả', route: '/admin/authors', icon: '✎' },
  { label: 'Bình luận', route: '/admin/comments', icon: '◌' },
  { label: 'Báo cáo', route: '/admin/reports', icon: '⚑' },
  { label: 'Danh mục', route: '/admin/categories', icon: '▦' },
  { label: 'Giao dịch', route: '/admin/transactions', icon: '₫' },
  { label: 'Quảng cáo', route: '/admin/ads', icon: '◈' },
  { label: 'Cấu hình', route: '/admin/settings', icon: '⚙' },
  { label: 'Nhật ký', route: '/admin/activity-logs', icon: '⌁' },
];
