export const AUTH_ROLES = {
    USER: 'USER',
    AUTHOR: 'AUTHOR',
    ADMIN: 'ADMIN',
} as const;

export type AuthRole =
    (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

export const AUTH_PERMISSIONS = {
    STORY_CREATE: 'story.create',

    LIBRARY_MANAGE_OWN:
        'library.manage.own',

    READING_HISTORY_MANAGE_OWN:
        'reading-history.manage.own',

    NOTIFICATION_MANAGE_OWN:
        'notification.manage.own',
} as const;

export type AuthPermission =
    (typeof AUTH_PERMISSIONS)[keyof typeof AUTH_PERMISSIONS];