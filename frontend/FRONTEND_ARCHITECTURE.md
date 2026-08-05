# Frontend architecture

Frontend dùng Angular standalone components và chia theo feature. Route chỉ làm nhiệm vụ lazy-load layout/page; trạng thái hiển thị nằm trong facade/view-model hiện có.

## Cấu trúc chính

```text
src/app/
├── core/
│   ├── i18n/
│   │   ├── auto-translate.directive.ts
│   │   └── i18n.service.ts
│   └── preferences/
│       ├── app-preferences.service.ts
│       └── preferences-control.component.*
├── layouts/
│   ├── public-layout/
│   └── workspace-layout/
├── shared/ui/
│   ├── app-logo/
│   ├── avatar/
│   ├── button/
│   └── ...
└── features/
    ├── public-site/
    ├── auth/
    ├── account-center/
    ├── author-suite/
    └── admin-center/
```

## Layout

- `PublicLayoutComponent`: header, search, navigation, mobile drawer, footer và preference controls cho web đọc truyện.
- `WorkspaceLayoutComponent`: sidebar/topbar dùng chung cho account, author và admin; từng khu vực chỉ truyền navigation, user data và accent.
- `AuthLayoutComponent`: chrome tối giản cho đăng nhập/đăng ký, dùng chung preference controls.

Không copy header/sidebar vào page. Page chỉ chứa nội dung nghiệp vụ của route.

## Shared UI

Các primitive dùng lại đặt trong `shared/ui`: button, card, avatar, logo, search và page header. Preference control thuộc `core/preferences` vì nó điều phối state ứng dụng. Style card, form, table, metric, toolbar, chart shell và responsive workspace nằm trong `src/styles/components/_workspace-pages.scss`.

Feature stylesheet chỉ giữ phần khác biệt thật sự, ví dụ accent của account/author/admin hoặc bố cục đặc thù của public/auth.

## Dark mode

`AppPreferencesService` quản lý `light | dark`, lưu `qlt-theme` vào `localStorage` và áp dụng `data-theme` lên `<html>`. Script nhỏ trong `index.html` đọc theme trước khi Angular bootstrap để tránh flash sai theme.

Màu sắc phải dùng design tokens (`--color-*`) thay vì hard-code trong component mới.

## Language switch

`AppPreferencesService` quản lý `vi | en`, lưu `qlt-language`. `I18nService` chứa dictionary và `AutoTranslateDirective` dịch text node cùng các thuộc tính `placeholder`, `aria-label`, `title` tại ba layout gốc. Nội dung không có key dịch sẽ giữ nguyên, vì vậy tên truyện/tác giả và dữ liệu người dùng không bị sửa.

Khi thêm label giao diện mới, bổ sung bản dịch tương ứng trong `core/i18n/i18n.service.ts`.

## Responsive rules

- Public: desktop navigation chuyển thành drawer dưới `1120px`; grid truyện giảm dần 5 → 4 → 3 → 2 cột.
- Workspace: sidebar chuyển thành off-canvas dưới `1080px`; table giữ scroll ngang.
- Form hai cột chuyển thành một cột dưới `760px`.

## One-shot migration

Chạy từ repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\Modernize-Frontend-OneShot.ps1
```

Script tự tìm `frontend/angular.json`, backup `frontend/src`, áp dụng payload UI, chạy `npm install` và `npm run build`. Có thể dùng `-SkipInstall`, `-SkipBuild` hoặc `-NoBackup` khi cần.
