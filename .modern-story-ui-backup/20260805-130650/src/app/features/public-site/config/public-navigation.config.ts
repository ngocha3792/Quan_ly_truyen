import { PublicNavigationItem } from '../../../layouts/public-layout/public-layout.component';

export const PUBLIC_NAVIGATION: readonly PublicNavigationItem[] = [
  { label: 'Trang chủ', route: '/', exact: true },
  { label: 'Thể loại', route: '/genres' },
  { label: 'Xếp hạng', route: '/rankings' },
  { label: 'Truyện mới', route: '/search' },
  { label: 'Tác giả', route: '/authors/huyen-huyen' },
];
