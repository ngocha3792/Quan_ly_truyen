import { environment } from '../../../environments/environment';

export const APP_NAME = environment.appName;
export const APP_WEB_CLIENT_NAME = `${APP_NAME} Web`;
export const APP_FILE_SLUG = APP_NAME.trim()
  .toLocaleLowerCase('en-US')
  .replace(/[^a-z0-9]+/gu, '-')
  .replace(/^-|-$/gu, '');
export const APP_DEFAULT_PAGE_TITLE = `${APP_NAME} - Đọc truyện online`;
export const APP_DEFAULT_SEO_DESCRIPTION = `${APP_NAME} - nền tảng đọc và quản lý truyện online.`;

export function appPageTitle(title: string): string {
  return `${title} - ${APP_NAME}`;
}
