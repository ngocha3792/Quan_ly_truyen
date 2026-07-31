# COMMON UTILS DOCUMENTATION

## 1. Cài dependency

```bash
npm install bcryptjs jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

`bcryptjs` đã có TypeScript declarations đi kèm. `jsonwebtoken` cần `@types/jsonwebtoken`.

## 2. Cấu trúc

```text
src/common/utils/
├── array.util.ts
├── bcrypt.util.ts
├── bcypt.util.ts
├── crypto.util.ts
├── date.util.ts
├── file.util.ts
├── ip.util.ts
├── jwt.util.ts
├── number.util.ts
├── object.util.ts
├── pagination.util.ts
├── promise.util.ts
├── redact.util.ts
├── slug.util.ts
├── string.util.ts
├── uuid.util.ts
└── index.ts
```

`bcypt.util.ts` là file tương thích cho tên viết sai. Code mới nên import từ `bcrypt.util.ts` hoặc barrel `common/utils`.

## 3. Bcrypt

```ts
import {
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from '@/common/utils';

const passwordHash = await hashPassword('MatKhauAnToan@123', {
  rounds: 12,
});

const matched = await verifyPassword(
  'MatKhauAnToan@123',
  passwordHash,
);

if (matched && needsPasswordRehash(passwordHash, 13)) {
  const newHash = await hashPassword('MatKhauAnToan@123', {
    rounds: 13,
  });
}
```

Utility từ chối password vượt quá 72 byte để tránh bcrypt âm thầm bỏ phần dữ liệu phía sau.

## 4. JWT

### Ký access token

```ts
import { signJwt } from '@/common/utils';

const accessToken = signJwt(
  {
    sid: session.id,
    typ: 'access',
    ver: user.tokenVersion,
  },
  {
    key: config.jwtAccessSecret,
    algorithm: 'HS256',
    expiresIn: '15m',
    issuer: 'quan-ly-truyen-api',
    audience: 'quan-ly-truyen-client',
    subject: user.id,
    jwtId: tokenId,
  },
);
```

### Xác minh token

```ts
import {
  CommonJwtClaims,
  verifyJwt,
} from '@/common/utils';

const payload = verifyJwt<CommonJwtClaims>(token, {
  key: config.jwtAccessSecret,
  algorithms: ['HS256'],
  issuer: 'quan-ly-truyen-api',
  audience: 'quan-ly-truyen-client',
  clockToleranceSeconds: 5,
});
```

Luôn truyền `algorithms`, `issuer` và `audience`. Không dùng `decodeJwtUnsafe()` để xác thực hoặc phân quyền vì hàm đó không kiểm tra chữ ký.

### Lấy Bearer token

```ts
const token = extractBearerToken(request.headers.authorization);
```

## 5. Crypto

```ts
const refreshToken = generateSecureToken(48);
const refreshTokenHash = sha256(refreshToken);
const verificationCode = generateNumericCode(6);
```

Nên lưu hash của refresh token, email-verification token và password-reset token thay vì lưu raw token.

## 6. Slug

```ts
const slug = slugify('Đấu Phá Thương Khung — Chương 01');
// dau-pha-thuong-khung-chuong-01
```

Unique slug vẫn phải được bảo đảm bằng unique constraint trong database. `createUniqueSlug()` chỉ hỗ trợ tạo candidate slug.

## 7. Pagination

```ts
const skip = calculateOffset(page, limit);

const meta = createPageMeta({
  page,
  limit,
  totalItems,
});
```

Cursor:

```ts
const cursor = encodeCursor({
  id: story.id,
  createdAt: story.createdAt.toISOString(),
});

const decoded = decodeCursor<{
  id: string;
  createdAt: string;
}>(cursor);
```

Cursor base64url chỉ là encoding, không phải encryption hay chữ ký. Không đưa dữ liệu bí mật vào cursor.

## 8. Logging redaction

```ts
const safePayload = redactSensitiveData(payload);
```

Các key mặc định bị che gồm password, passwordHash, accessToken, refreshToken, authorization, cookie, secret và clientSecret.

## 9. IP utility

Chỉ tin `x-forwarded-for` khi reverse proxy của ứng dụng được cấu hình và kiểm soát. Nếu client có thể kết nối trực tiếp tới API, client có thể tự giả mạo header này.

## 10. Quy tắc kiến trúc

Utility nên:

- Là hàm thuần hoặc wrapper kỹ thuật nhỏ.
- Không truy vấn database.
- Không chứa business rule của Story, Chapter, Author hoặc User.
- Không đọc trực tiếp `process.env`; truyền config từ ngoài vào.
- Không dùng `decodeJwtUnsafe()` để cấp quyền.

Những thành phần cần dependency injection hoặc state nên chuyển sang `common/ports`, `infrastructure`, hoặc module nghiệp vụ thay vì tiếp tục nhét vào `utils`.
  