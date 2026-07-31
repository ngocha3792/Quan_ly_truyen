import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  accessTokenSecret: process.env.JWT_ACCESS_SECRET,
  issuer: process.env.JWT_ISSUER ?? 'quan-ly-truyen-api',
  audience: process.env.JWT_AUDIENCE ?? 'quan-ly-truyen-web',
}));
