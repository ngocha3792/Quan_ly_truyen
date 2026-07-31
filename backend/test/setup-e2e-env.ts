import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-at-least-32-characters';
process.env.JWT_ISSUER = 'quan-ly-truyen-e2e';
process.env.JWT_AUDIENCE = 'quan-ly-truyen-e2e-client';
process.env.REDIS_ENABLED = 'false';
process.env.QUEUE_ENABLED = 'false';
process.env.MAIL_ENABLED = 'false';
process.env.CLOUDINARY_ENABLED = 'true';
process.env.CLOUDINARY_CLOUD_NAME = 'e2e-cloud';
process.env.CLOUDINARY_API_KEY = 'e2e-public-key';
process.env.CLOUDINARY_API_SECRET = 'e2e-cloudinary-secret';
process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET = 'avatar';
process.env.CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET = 'banner';
process.env.CLOUDINARY_STORY_COVER_UPLOAD_PRESET = 'cover';
process.env.CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET = 'chapter';
process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET = 'attachment';
