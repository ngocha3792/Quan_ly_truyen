export enum PermissionCode {
  USER_PROFILE_READ = 'user.profile.read',
  USER_PROFILE_UPDATE = 'user.profile.update',
  USER_MANAGE = 'user.manage',
  USER_SECURITY_READ = 'user.security.read',
  USER_SECURITY_MANAGE = 'user.security.manage',
  ROLE_MANAGE = 'role.manage',

  STORY_READ = 'story.read',
  STORY_CREATE = 'story.create',
  STORY_UPDATE_OWN = 'story.update.own',
  STORY_DELETE_OWN = 'story.delete.own',
  STORY_SUBMIT = 'story.submit',
  STORY_REVIEW = 'story.review',
  STORY_PUBLISH = 'story.publish',
  STORY_UPDATE_ANY = 'story.update.any',
  STORY_DELETE_ANY = 'story.delete.any',

  CHAPTER_CREATE = 'chapter.create',
  CHAPTER_UPDATE_OWN = 'chapter.update.own',
  CHAPTER_DELETE_OWN = 'chapter.delete.own',
  CHAPTER_PUBLISH_OWN = 'chapter.publish.own',
  CHAPTER_MANAGE_ANY = 'chapter.manage.any',

  COMMENT_CREATE = 'comment.create',
  COMMENT_UPDATE_OWN = 'comment.update.own',
  COMMENT_DELETE_OWN = 'comment.delete.own',
  COMMENT_MODERATE = 'comment.moderate',

  RATING_CREATE = 'rating.create',
  RATING_UPDATE_OWN = 'rating.update.own',
  LIBRARY_MANAGE_OWN = 'library.manage.own',
  FOLLOW_MANAGE_OWN = 'follow.manage.own',
  READING_HISTORY_MANAGE_OWN = 'reading-history.manage.own',
  READING_BOOKMARK_MANAGE_OWN = 'reading-bookmark.manage.own',
  READING_GOAL_MANAGE_OWN = 'reading-goal.manage.own',

  REPORT_CREATE = 'report.create',
  REPORT_REVIEW = 'report.review',
  MODERATION_EXECUTE = 'moderation.execute',

  CATEGORY_MANAGE = 'category.manage',
  TAG_MANAGE = 'tag.manage',

  MEDIA_UPLOAD = 'media.upload',
  MEDIA_MANAGE_ANY = 'media.manage.any',

  NOTIFICATION_MANAGE_OWN = 'notification.manage.own',

  AUDIT_LOG_READ = 'audit-log.read',
  ANALYTICS_READ = 'analytics.read',

  AUTHOR_APPLICATION_CREATE = 'author-application.create',

  AUTHOR_APPLICATION_READ_OWN = 'author-application.read.own',

  AUTHOR_APPLICATION_REVIEW = 'author-application.review',

  AUTHOR_READ = 'author.read',
  AUTHOR_STATUS_MANAGE = 'author.status.manage',
}
