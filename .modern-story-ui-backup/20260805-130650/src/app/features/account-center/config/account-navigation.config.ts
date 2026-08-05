import { WorkspaceNavigationItem } from '../../../layouts/workspace-layout/workspace-layout.component';

export const ACCOUNT_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  { label: 'Tổng quan', route: '/account', icon: '▦', exact: true },
  { label: 'Lịch sử đọc', route: '/account/history', icon: '◴' },
  { label: 'Thư viện', route: '/account/library', icon: '▤' },
  { label: 'Đang theo dõi', route: '/account/following', icon: '♡' },
  { label: 'Đánh giá', route: '/account/reviews', icon: '☆' },
  { label: 'Bình luận', route: '/account/comments', icon: '◌' },
  { label: 'Thông tin tài khoản', route: '/account/profile', icon: '♙' },
  { label: 'Bảo mật', route: '/account/security', icon: '▣' },
  { label: 'Thông báo', route: '/account/notifications', icon: '♢' },
  { label: 'Giao dịch', route: '/account/transactions', icon: '₫' },
];
