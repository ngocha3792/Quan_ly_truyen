# Migration from RequestContextInterceptor

## 1. Gỡ provider global

Xóa:

```ts
{
  provide: APP_INTERCEPTOR,
  useClass: RequestContextInterceptor,
}
```

## 2. Đăng ký middleware trước guard

```ts
consumer
  .apply(RequestContextMiddleware, LocaleMiddleware)
  .forRoutes({
    path: '{*path}',
    method: RequestMethod.ALL,
  });
```

## 3. Re-export type cũ nếu chưa sửa hết import

```ts
export type {
  MiddlewareHttpRequest as HttpRequestWithContext,
  MutableRequestContext as RequestContextData,
} from '../middlewares';
```

## 4. Không sinh ID trong filter/interceptor

Filter có thể fallback UUID chỉ để chống lỗi cấu hình, nhưng bình thường phải dùng `request.requestId` do middleware tạo.
