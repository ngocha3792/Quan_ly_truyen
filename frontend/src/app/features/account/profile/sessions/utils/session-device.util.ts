import {
    AccountSecurityEventDto,
    AccountSessionDto,
    AccountSessionViewModel,
    LoginActivityViewModel,
    SessionBrowser,
    SessionDeviceInfo,
    SessionStatus,
} from '../domain/account-session.models';

export function toSessionViewModel(
    session: AccountSessionDto,
    now = Date.now(),
): AccountSessionViewModel {
    const device =
        parseSessionDevice(session.userAgent);

    const status =
        resolveSessionStatus(session, now);

    const title =
        session.deviceName?.trim() ||
        `${device.browserName} trên ${device.operatingSystem}`;

    const browserDescription =
        device.browserVersion
            ? `${device.browserName} ${device.browserVersion}`
            : device.browserName;

    return {
        id: session.id,
        isCurrent: session.isCurrent,
        trusted: Boolean(session.trusted),

        title,
        subtitle: [
            device.operatingSystem,
            browserDescription,
        ].join(' • '),

        browser: device.browser,
        browserName: device.browserName,
        operatingSystem:
            device.operatingSystem,
        deviceType: device.deviceType,

        location:
            readSessionLocation(session),

        ipAddress: session.ipAddress,

        lastUsedAt:
            session.lastUsedAt ??
            session.createdAt,

        createdAt: session.createdAt,
        expiresAt: session.expiresAt,

        status,
        statusLabel:
            getSessionStatusLabel(status),

        canRevoke:
            !session.isCurrent &&
            status === 'active',
    };
}

export function toLoginActivityViewModel(
    event: AccountSecurityEventDto,
): LoginActivityViewModel {
    const device =
        parseSessionDevice(event.userAgent);

    const metadata = event.metadata;

    const deviceName =
        readString(metadata, 'deviceName') ||
        readString(metadata, 'device_name');

    const title =
        deviceName ||
        `${device.browserName} trên ${device.operatingSystem}`;

    const location =
        readString(metadata, 'location') ||
        readString(metadata, 'city') ||
        'Không xác định';

    const signedOut =
        event.action
            .toLowerCase()
            .includes('logout') ||
        event.action
            .toLowerCase()
            .includes('revoked');

    const current =
        readBoolean(metadata, 'isCurrent');

    return {
        id: event.id,

        browser: device.browser,
        title,

        subtitle: [
            device.browserName,
            device.operatingSystem,
        ].join(' • '),

        location,
        ipAddress: event.ipAddress,
        occurredAt: event.createdAt,

        status: signedOut
            ? 'signed-out'
            : current
                ? 'current'
                : 'active',

        statusLabel: signedOut
            ? 'Đã đăng xuất'
            : current
                ? 'Hiện tại'
                : 'Hoạt động',
    };
}

export function parseSessionDevice(
    userAgent: string | null,
): SessionDeviceInfo {
    const ua = userAgent ?? '';

    const edgeMatch =
        ua.match(/Edg\/([\d.]+)/u);

    const operaMatch =
        ua.match(/OPR\/([\d.]+)/u);

    const chromeMatch =
        ua.match(/Chrome\/([\d.]+)/u);

    const firefoxMatch =
        ua.match(/Firefox\/([\d.]+)/u);

    const safariMatch =
        ua.match(/Version\/([\d.]+).*Safari/u);

    let browser: SessionBrowser =
        'browser';

    let browserName =
        'Trình duyệt';

    let browserVersion:
        string | null = null;

    if (edgeMatch) {
        browser = 'edge';
        browserName = 'Microsoft Edge';
        browserVersion = edgeMatch[1];
    } else if (operaMatch) {
        browser = 'opera';
        browserName = 'Opera';
        browserVersion = operaMatch[1];
    } else if (firefoxMatch) {
        browser = 'firefox';
        browserName = 'Firefox';
        browserVersion = firefoxMatch[1];
    } else if (chromeMatch) {
        browser = 'chrome';
        browserName = 'Chrome';
        browserVersion = chromeMatch[1];
    } else if (safariMatch) {
        browser = 'safari';
        browserName = 'Safari';
        browserVersion = safariMatch[1];
    }

    const operatingSystem =
        detectOperatingSystem(ua);

    const deviceType =
        detectDeviceType(ua);

    return {
        browser,
        browserName,
        browserVersion,
        operatingSystem,
        deviceType,
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

function resolveSessionStatus(
    session: AccountSessionDto,
    now: number,
): SessionStatus {
    if (session.revokedAt) {
        return 'revoked';
    }

    if (session.isCurrent) {
        return 'current';
    }

    const expiresAt =
        new Date(session.expiresAt).getTime();

    if (
        Number.isFinite(expiresAt) &&
        expiresAt <= now
    ) {
        return 'expired';
    }

    return 'active';
}

function getSessionStatusLabel(
    status: SessionStatus,
): string {
    switch (status) {
        case 'current':
            return 'Đang hoạt động';

        case 'active':
            return 'Hoạt động';

        case 'expired':
            return 'Đã hết hạn';

        case 'revoked':
            return 'Đã thu hồi';
    }
}

function detectOperatingSystem(
    userAgent: string,
): string {
    if (
        /Windows NT 10\.0/u.test(userAgent)
    ) {
        return 'Windows 10/11';
    }

    if (/Windows/u.test(userAgent)) {
        return 'Windows';
    }

    if (
        /iPhone OS ([\d_]+)/u.test(userAgent)
    ) {
        return 'iOS';
    }

    if (
        /iPad.*OS ([\d_]+)/u.test(userAgent)
    ) {
        return 'iPadOS';
    }

    if (/Android/u.test(userAgent)) {
        return 'Android';
    }

    if (
        /Mac OS X ([\d_]+)/u.test(userAgent)
    ) {
        return 'macOS';
    }

    if (/Linux/u.test(userAgent)) {
        return 'Linux';
    }

    return 'Hệ điều hành không xác định';
}

function detectDeviceType(
    userAgent: string,
):
    | 'desktop'
    | 'mobile'
    | 'tablet'
    | 'unknown' {
    if (/iPad|Tablet/u.test(userAgent)) {
        return 'tablet';
    }

    if (
        /Mobile|iPhone|Android/u.test(
            userAgent,
        )
    ) {
        return 'mobile';
    }

    if (
        /Windows|Macintosh|Linux/u.test(
            userAgent,
        )
    ) {
        return 'desktop';
    }

    return 'unknown';
}

function readSessionLocation(
    session: AccountSessionDto,
): string {
    if (session.location?.trim()) {
        return session.location.trim();
    }

    const metadataLocation =
        readString(
            session.metadata,
            'location',
        ) ||
        readString(
            session.metadata,
            'city',
        );

    return (
        metadataLocation ||
        'Không xác định'
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