import { Routes } from '@angular/router';

import { AccountLayoutComponent } from './layout/account-layout/account-layout.component';

export const ACCOUNT_ROUTES: Routes = [
    {
        path: '',
        component: AccountLayoutComponent,
        children: [
            {
                path: '',
                pathMatch: 'full',
                title: 'Tổng quan tài khoản - TruyenHub',
                loadComponent: () =>
                    import(
                        './pages/account-overview-page/account-overview-page.component'
                    ).then(
                        (module) =>
                            module.AccountOverviewPageComponent,
                    ),
            },
            {
                path: 'thong-tin-ca-nhan',
                title: 'Thông tin cá nhân - TruyenHub',
                loadComponent: () =>
                    import(
                        './profile/pages/account-profile-page/account-profile-page.component'
                    ).then(
                        (module) =>
                            module.AccountProfilePageComponent,
                    ),
            },
            {
                path: 'bao-mat',
                title:
                    'Bảo mật tài khoản - TruyenHub',
                loadComponent: () =>
                    import(
                        './secutity/pages/account-security-page/account-security-page.component'
                    ).then(
                        (module) =>
                            module.AccountSecurityPageComponent,
                    ),
            },
            {
                path: 'bao-mat/xac-thuc-2-lop',
                title:
                    'Xác thực hai lớp - TruyenHub',

                loadComponent: () =>
                    import(
                        './secutity/features/mfa/mfa-settings-page.component'
                    ).then(
                        (module) =>
                            module.MfaSettingsPageComponent,
                    ),
            },
            {
                path: 'bao-mat/email-khoi-phuc',
                title:
                    'Email khôi phục - TruyenHub',

                loadComponent: () =>
                    import(
                        './secutity/features/recovery-email/recovery-email-page.component'
                    ).then(
                        (module) =>
                            module.RecoveryEmailPageComponent,
                    ),
            },
            {
                path: 'bao-mat/cau-hoi-bao-mat',
                title:
                    'Câu hỏi bảo mật - TruyenHub',

                loadComponent: () =>
                    import(
                        './secutity/features/security-questions/security-questions-page.component'
                    ).then(
                        (module) =>
                            module.SecurityQuestionsPageComponent,
                    ),
            },
            {
                path: 'thiet-bi',
                title:
                    'Thiết bị đăng nhập - TruyenHub',

                loadComponent: () =>
                    import(
                        './sessions/pages/account-sessions-page/account-sessions-page.component'
                    ).then(
                        (module) =>
                            module.AccountSessionsPageComponent,
                    ),
            },
            {
                path: 'hoat-dong',
                title:
                    'Lịch sử hoạt động - TruyenHub',

                loadComponent: () =>
                    import(
                        './activity/pages/account-activity-page/account-activity-page.component'
                    ).then(
                        (module) =>
                            module.AccountActivityPageComponent,
                    ),
            },
        ],
    },
];