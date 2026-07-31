# Các Guard Dùng Chung (Common Guards)

## Mục đích

Tầng guards dùng chung thực hiện nhiệm vụ xác thực ở cấp độ truyền tải (transport-level authentication) và phân quyền dựa trên claim (claim-based authorization). Tầng này **không** truy vấn dữ liệu của story, chapter, comment hay dữ liệu về quyền sở hữu (ownership).

## Thư mục

```text
src/common/guards/
├── common-guards.module.ts
├── guard-principal.interface.ts
├── guard-request.util.ts
├── jwt-auth.guard.ts
├── optional-jwt-auth.guard.ts
├── passport-auth-failure.util.ts
├── permissions.guard.ts
├── roles.guard.ts
├── verified-email.guard.ts
└── index.ts
```

## Global Guards

`CommonGuardsModule` đăng ký các guard theo thứ tự sau:

1. `JwtAuthGuard`
2. `RolesGuard`
3. `PermissionsGuard`

Chỉ cần import nó một lần duy nhất trong `AppModule`:

```ts
@Module({
  imports: [
    AuthModule,
    CommonGuardsModule,
  ],
})
export class AppModule {}
```

Không đăng ký thêm các guard này thông qua `app.useGlobalGuards()`.

## Route Công khai (Public Route)

```ts
@Public()
@Get(':slug')
findPublishedStory() {}
```

Decorator `@Public()` chỉ bỏ qua guard access-token toàn cục (`JwtAuthGuard`). Các guard kiểm tra Role và Permission vẫn sẽ cho qua khi route không khai báo metadata tương ứng.

## Route Dành cho Khách hoặc User (Guest-or-User Route)

Sử dụng kết hợp cả hai decorator:

```ts
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Get(':slug')
findStory() {}
```

Hành vi xử lý:

- Không có header `Authorization`: Cho phép request truy cập dưới dạng Guest (Khách);
- Token Bearer hợp lệ: Dữ liệu người dùng sẽ được gán vào `request.user`;
- Token sai định dạng hoặc hết hạn: Request sẽ bị từ chối.

Không tự động coi một request gửi kèm token không hợp lệ là Guest.

## Vai trò (Roles)

```ts
@Roles(RoleCode.AUTHOR, RoleCode.ADMIN)
@Post()
createStory() {}
```

Metadata của Role sử dụng toán tử **HOẶC** (OR semantics). Người dùng (principal) chỉ cần có ít nhất một trong các vai trò được khai báo.

## Quyền hạn (Permissions)

```ts
@RequirePermissions(
  PermissionCode.STORY_REVIEW,
  PermissionCode.STORY_PUBLISH,
)
@Post(':id/publish')
publishStory() {}
```

Metadata của Permission sử dụng toán tử **VÀ** (AND semantics). Người dùng (principal) bắt buộc phải có đầy đủ tất cả các quyền được khai báo.

## Xác thực Email (Verified Email)

```ts
@UseGuards(VerifiedEmailGuard)
@Post()
createReport() {}
```

Strategy JWT phải đính kèm một trong hai thông tin sau:

```ts
emailVerified: true
```

hoặc:

```ts
emailVerifiedAt: Date | string
```

## Khai báo chuẩn cho Principal (Principal Contract)

Strategy access-token nên trả về cấu trúc dữ liệu tương thích với:

```ts
interface GuardPrincipal {
  userId?: string;
  sub?: string;
  sessionId?: string;
  sid?: string;
  roles?: readonly string[];
  permissions?: readonly string[];
  emailVerified?: boolean;
  emailVerifiedAt?: Date | string | null;
}
```

Kết quả đã chuẩn hóa (normalized) được khuyến nghị trả về từ strategy:

```ts
return {
  userId: user.id,
  sessionId: session.id,
  roles: roleCodes,
  permissions: permissionCodes,
  emailVerified: user.emailVerifiedAt !== null,
  emailVerifiedAt: user.emailVerifiedAt,
};
```

## Quyền sở hữu (Ownership)

Không tạo các guard kiểu `StoryOwnershipGuard` để truy vấn Prisma. Quy tắc kiểm tra quyền sở hữu và trạng thái thuộc về các policy/use case ở tầng application:

```ts
storyAccessPolicy.assertCanUpdate({
  actor: principal,
  story,
});
```

Guard trả lời câu hỏi liệu người gọi có **quyền chung** hay không. Use case trả lời câu hỏi liệu người gọi có được phép thao tác trên một **tài nguyên cụ thể** hay không.

## Kiểm thử (Tests)

Đối với các bài test phân quyền (authorization), cần đảm bảo kiểm thử ít nhất các trường hợp sau:

- Public route khi không gửi kèm token;
- Protected route khi không gửi kèm token;
- Access token đã hết hạn hoặc sai định dạng;
- Optional route khi không gửi kèm token;
- Optional route khi gửi kèm token không hợp lệ;
- Logic toán tử OR của Role;
- Logic toán tử AND của Permission;
- Email đã xác thực và chưa xác thực;
- Metadata được khai báo ở cấp Controller và cấp Handler.

