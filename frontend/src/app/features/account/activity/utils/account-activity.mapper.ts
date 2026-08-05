import {
    AccountActivityViewModel,
    AccountSecurityEventDto,
    ActivityCategory,
    ActivitySessionDto,
    ActivityStatus,
    ActivityTone,
    ActivityVisual,
    RecentDeviceViewModel,
} from '../domain/account-activity.models';

interface DeviceInfo {
    readonly browserName: string;
    readonly operatingSystem: string;
}

interface ActivityDescriptor {
    readonly title: string;

    readonly category: Exclude<
        ActivityCategory,
        'all'
    >;

    readonly visual: ActivityVisual;
    readonly tone: ActivityTone;

    readonly status: ActivityStatus;
    readonly statusLabel: string | null;

    readonly suspicious: boolean;
}

export function mapSecurityEvent(
    event: AccountSecurityEventDto,
): AccountActivityViewModel {
    const normalizedAction = normalizeAction(
        event.action,
    );

    const descriptor = describeAction(
        normalizedAction,
    );

    const device = parseDevice(
        event.userAgent,
    );

    const metadata = event.metadata;

    const deviceName =
        readString(metadata, 'deviceName') ??
        readString(metadata, 'device_name') ??
        `${device.browserName} trên ${device.operatingSystem}`;

    const location =
        readString(metadata, 'location') ??
        readString(metadata, 'city') ??
        readString(metadata, 'country') ??
        'Không xác định';

    const description =
        createDescription(
            normalizedAction,
            event,
            deviceName,
            location,
        );

    const metadataSuspicious =
        readBoolean(
            metadata,
            'suspicious',
        ) ||
        readBoolean(
            metadata,
            'isSuspicious',
        ) ||
        readString(
            metadata,
            'riskLevel',
        )?.toLowerCase() === 'high';

    return {
        id: event.id,
        action: event.action,

        title: descriptor.title,
        description,

        category: descriptor.category,

        visual: descriptor.visual,
        tone: descriptor.tone,

        status: descriptor.status,
        statusLabel:
            descriptor.statusLabel,

        browserName:
            device.browserName,

        operatingSystem:
            device.operatingSystem,

        deviceLabel: deviceName,

        location,
        ipAddress: event.ipAddress,

        occurredAt: event.createdAt,

        suspicious:
            descriptor.suspicious ||
            metadataSuspicious,
    };
}

export function mapSessionToRecentDevice(
    session: ActivitySessionDto,
    now = Date.now(),
): RecentDeviceViewModel {
    const device = parseDevice(
        session.userAgent,
    );

    const expiresAt =
        new Date(
            session.expiresAt,
        ).getTime();

    const active =
        !session.revokedAt &&
        (
            !Number.isFinite(expiresAt) ||
            expiresAt > now
        );

    const deviceName =
        session.deviceName?.trim() ||
        `${device.operatingSystem} • ${device.browserName}`;

    return {
        id: session.id,

        deviceName,

        description: [
            device.operatingSystem,
            device.browserName,
        ].join(' • '),

        operatingSystem:
            device.operatingSystem,

        browserName:
            device.browserName,

        location:
            session.location?.trim() ||
            'Không xác định',

        ipAddress:
            session.ipAddress,

        lastUsedAt:
            session.lastUsedAt ??
            session.createdAt,

        current:
            session.isCurrent,

        active,
    };
}

export function normalizeSearchText(
    value: string,
): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

function describeAction(
    action: string,
): ActivityDescriptor {
    if (
        includesAny(action, [
            'suspicious_login',
            'unusual_login',
            'login_risk',
            'login_failed',
            'failed_login',
        ])
    ) {
        return {
            title:
                action.includes('failed')
                    ? 'Đăng nhập thất bại'
                    : 'Phát hiện đăng nhập lạ',

            category: 'login',

            visual: 'warning',
            tone: 'red',

            status: 'warning',
            statusLabel: 'Cảnh báo',

            suspicious: true,
        };
    }

    if (
        includesAny(action, [
            'login_success',
            'logged_in',
            'session_created',
            'sign_in',
        ])
    ) {
        return {
            title: 'Đăng nhập thành công',
            category: 'login',

            visual: 'login',
            tone: 'green',

            status: 'success',
            statusLabel: 'Thành công',

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'logout',
            'logged_out',
            'sign_out',
        ])
    ) {
        return {
            title: 'Đăng xuất',
            category: 'login',

            visual: 'logout',
            tone: 'neutral',

            status: 'neutral',
            statusLabel: null,

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'password_changed',
            'change_password',
            'password_updated',
            'password_reset',
        ])
    ) {
        return {
            title: 'Đổi mật khẩu',
            category: 'security',

            visual: 'password',
            tone: 'blue',

            status: 'success',
            statusLabel: null,

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'mfa_enabled',
            'mfa_setup',
            'two_factor_enabled',
            '2fa_enabled',
        ])
    ) {
        return {
            title: 'Bật xác thực hai lớp',
            category: 'security',

            visual: 'mfa',
            tone: 'green',

            status: 'success',
            statusLabel: null,

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'mfa_disabled',
            'two_factor_disabled',
            '2fa_disabled',
        ])
    ) {
        return {
            title: 'Tắt xác thực hai lớp',
            category: 'security',

            visual: 'mfa',
            tone: 'orange',

            status: 'warning',
            statusLabel: 'Cần chú ý',

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'recovery_email',
            'email_recovery',
            'email_verified',
        ])
    ) {
        return {
            title:
                action.includes('remove') ||
                    action.includes('delete')
                    ? 'Xóa email khôi phục'
                    : 'Thêm email khôi phục',

            category: 'security',

            visual: 'email',
            tone: 'purple',

            status: 'success',
            statusLabel: null,

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'session_revoked',
            'revoke_session',
            'session_terminated',
        ])
    ) {
        return {
            title: 'Thu hồi phiên đăng nhập',
            category: 'device',

            visual: 'session',
            tone: 'orange',

            status: 'info',
            statusLabel: null,

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'new_device',
            'device_added',
            'trusted_device',
        ])
    ) {
        return {
            title: 'Thiết bị đăng nhập mới',
            category: 'device',

            visual: 'device',
            tone: 'orange',

            status: 'info',
            statusLabel: 'Thiết bị mới',

            suspicious: false,
        };
    }

    if (
        includesAny(action, [
            'profile_updated',
            'user_updated',
            'account_updated',
            'display_name_changed',
            'avatar_changed',
        ])
    ) {
        return {
            title: 'Cập nhật thông tin cá nhân',
            category: 'account',

            visual: 'profile',
            tone: 'blue',

            status: 'info',
            statusLabel: null,

            suspicious: false,
        };
    }

    return {
        title: humanizeAction(action),

        category: 'account',

        visual: 'generic',
        tone: 'neutral',

        status: 'neutral',
        statusLabel: null,

        suspicious: false,
    };
}

function createDescription(
    action: string,
    event: AccountSecurityEventDto,
    deviceName: string,
    location: string,
): string {
    const metadata = event.metadata;

    const description =
        readString(
            metadata,
            'description',
        ) ??
        readString(
            metadata,
            'message',
        );

    if (description) {
        return description;
    }

    if (
        includesAny(action, [
            'login_success',
            'logged_in',
            'sign_in',
        ])
    ) {
        return [
            deviceName,
            event.ipAddress
                ? `IP ${event.ipAddress}`
                : null,
            location,
        ]
            .filter(Boolean)
            .join(' • ');
    }

    if (
        includesAny(action, [
            'suspicious_login',
            'unusual_login',
            'login_failed',
        ])
    ) {
        return [
            deviceName,
            event.ipAddress
                ? `IP ${event.ipAddress}`
                : null,
            location,
        ]
            .filter(Boolean)
            .join(' • ');
    }

    if (
        action.includes('password')
    ) {
        return 'Bảo mật tài khoản đã được cập nhật';
    }

    if (
        action.includes('mfa') ||
        action.includes('two_factor') ||
        action.includes('2fa')
    ) {
        return 'Cấu hình xác thực hai lớp đã thay đổi';
    }

    if (
        action.includes('recovery_email') ||
        action.includes('email_recovery')
    ) {
        const email =
            readString(
                metadata,
                'email',
            );

        return email
            ? `${email} đã được cập nhật`
            : 'Email khôi phục đã được cập nhật';
    }

    if (
        action.includes('session')
    ) {
        return [
            deviceName,
            location,
        ].join(' • ');
    }

    if (
        action.includes('profile') ||
        action.includes('user_updated')
    ) {
        return 'Thông tin tài khoản đã được thay đổi';
    }

    return [
        event.entityType,
        event.entityId,
    ]
        .filter(Boolean)
        .join(' • ') ||
        'Hoạt động tài khoản';
}

function parseDevice(
    userAgent: string | null,
): DeviceInfo {
    const ua = userAgent ?? '';

    let browserName =
        'Trình duyệt';

    if (/Edg\//u.test(ua)) {
        browserName =
            'Microsoft Edge';
    } else if (/OPR\//u.test(ua)) {
        browserName = 'Opera';
    } else if (/Firefox\//u.test(ua)) {
        browserName = 'Firefox';
    } else if (/Chrome\//u.test(ua)) {
        browserName = 'Chrome';
    } else if (
        /Safari\//u.test(ua)
    ) {
        browserName = 'Safari';
    }

    let operatingSystem =
        'Thiết bị không xác định';

    if (
        /Windows NT 10\.0/u.test(ua)
    ) {
        operatingSystem = 'Windows';
    } else if (/Windows/u.test(ua)) {
        operatingSystem = 'Windows';
    } else if (/iPhone/u.test(ua)) {
        operatingSystem = 'iPhone';
    } else if (/iPad/u.test(ua)) {
        operatingSystem = 'iPad';
    } else if (/Android/u.test(ua)) {
        operatingSystem = 'Android';
    } else if (
        /Mac OS X|Macintosh/u.test(ua)
    ) {
        operatingSystem = 'macOS';
    } else if (/Linux/u.test(ua)) {
        operatingSystem = 'Linux';
    }

    return {
        browserName,
        operatingSystem,
    };
}

function normalizeAction(
    action: string,
): string {
    return action
        .trim()
        .toLowerCase()
        .replace(/[.\s-]+/gu, '_');
}

function includesAny(
    value: string,
    candidates: readonly string[],
): boolean {
    return candidates.some(
        (candidate) =>
            value.includes(candidate),
    );
}

function humanizeAction(
    action: string,
): string {
    const value = action
        .replace(/[_-]+/gu, ' ')
        .trim();

    if (!value) {
        return 'Hoạt động tài khoản';
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}

function readString(
    record:
        | Readonly<Record<string, unknown>>
        | null
        | undefined,
    key: string,
): string | null {
    const value = record?.[key];

    return typeof value === 'string' &&
        value.trim()
        ? value.trim()
        : null;
}

function readBoolean(
    record:
        | Readonly<Record<string, unknown>>
        | null
        | undefined,
    key: string,
): boolean {
    return record?.[key] === true;
}