import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import {
    RouterLink,
    RouterLinkActive,
} from '@angular/router';

import { CurrentUser } from '../../../../core/auth/auth.models';

import {
    IconComponent,
    IconName,
} from '../../../../shared/components/icon/icon.component';

import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

interface AccountNavigationItem {
    readonly label: string;
    readonly route: string;
    readonly icon: IconName;
    readonly exact: boolean;
}

@Component({
    selector: 'app-account-sidebar',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        IconComponent,
        UserAvatarComponent,
    ],
    templateUrl:
        './account-sidebar.component.html',
    styleUrl:
        './account-sidebar.component.scss',
    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AccountSidebarComponent {
    readonly user =
        input<CurrentUser | null>(null);

    readonly logoutRequested =
        output<void>();

    protected readonly navigation:
        readonly AccountNavigationItem[] = [
            {
                label: 'Tổng quan',
                route: '/tai-khoan',
                icon: 'grid',
                exact: true,
            },
            {
                label: 'Thông tin cá nhân',
                route:
                    '/tai-khoan/thong-tin-ca-nhan',
                icon: 'user',
                exact: false,
            },
            {
                label: 'Bảo mật',
                route:
                    '/tai-khoan/bao-mat',
                icon: 'shield',
                exact: false,
            },
            {
                label: 'Thiết bị đăng nhập',
                route:
                    '/tai-khoan/thiet-bi',
                icon: 'monitor',
                exact: false,
            },
            {
                label: 'Lịch sử hoạt động',
                route:
                    '/tai-khoan/hoat-dong',
                icon: 'history',
                exact: false,
            },
        ];

    protected getRoleLabel(
        roles: readonly string[],
    ): string {
        const normalizedRoles =
            roles.map((role) =>
                role.toLowerCase(),
            );

        if (
            normalizedRoles.includes('admin')
        ) {
            return 'Quản trị viên';
        }

        if (
            normalizedRoles.includes('author')
        ) {
            return 'Tác giả';
        }

        return 'Thành viên';
    }
}