export const AUTH_ROLES = {
  USER: 'USER',
  AUTHOR: 'AUTHOR',
  ADMIN: 'ADMIN',
} as const;

export type AuthRole = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

export const AUTH_PERMISSIONS = {
  STORY_CREATE: 'story.create',

  LIBRARY_MANAGE_OWN: 'library.manage.own',

  READING_HISTORY_MANAGE_OWN: 'reading-history.manage.own',

  NOTIFICATION_MANAGE_OWN: 'notification.manage.own',
  AUTHOR_APPLICATION_CREATE: 'author-application.create',

  AUTHOR_APPLICATION_READ_OWN: 'author-application.read.own',

  AUTHOR_APPLICATION_REVIEW: 'author-application.review',
} as const;

export type AuthPermission = (typeof AUTH_PERMISSIONS)[keyof typeof AUTH_PERMISSIONS];
