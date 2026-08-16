import { RenderMode, ServerRoute } from '@angular/ssr';

const SSR_PUBLIC_ROUTES = [
  '',
  'truyen/:slug',
  'truyen/:storySlug/chuong/:chapterNumber',
  'danh-sach',
  'the-loai',
  'xep-hang',
  'cap-nhat',
  'gioi-thieu',
  'dieu-khoan',
  'quyen-rieng-tu',
  'cong-dong',
  'tac-gia',
  'tac-gia/:authorSlug',
] as const;

export const serverRoutes: ServerRoute[] = [
  ...SSR_PUBLIC_ROUTES.map((path): ServerRoute => ({ path, renderMode: RenderMode.Server })),
  { path: '**', renderMode: RenderMode.Client },
];
