# Production Runbook

## Release gate

1. CI phải xanh: lint, build, typecheck, unit, integration, E2E và dependency audit.
2. Backend và frontend production phải dùng full 40-character Git SHA; không dùng `latest`, branch tag hoặc tag mutable. Runtime và migrate backend phải cùng source SHA.
3. Tạo `.env.production` bằng `New-ProductionEnv.ps1`; không dùng file example.
4. Chạy `Deploy-Production.ps1` và không bỏ qua predeploy/postdeploy gate khi release thật.
5. Kiểm tra `/api/v1/health/live`, `/api/v1/health/ready`, worker heartbeat, mail delivery và dashboard.

## External requirements

Các mục sau không thể được tự động hóa chỉ bằng repository:

- DNS A/AAAA của `APP_DOMAIN` trỏ đúng máy chủ và cổng 80/443 mở.
- SPF cho domain gửi mail.
- DKIM key/selector được cấu hình tại SMTP provider và DNS.
- DMARC được bật, ban đầu có thể dùng `p=none`, sau đó nâng chính sách.
- SMTP production cho phép From/Reply-To đã khai báo.
- Backup được sao chép sang storage khác máy chủ và được mã hóa.

## Deploy

```powershell
./ops/production/Deploy-Production.ps1
```

Server chỉ pull image đã được CI publish. `Deploy-Production.ps1` từ chối tag application không phải full Git SHA trong registry mode. Build trực tiếp trên server chỉ dùng cho staging/local qua `compose.production.build.yml`.

Kiểm tra Compose trước deploy mà không cần secret thật:

```powershell
npm run docker:prod:config:example
```

Frontend container chạy non-root trên cổng nội bộ `8080`, filesystem read-only và drop toàn bộ Linux capabilities trong production Compose.

## Maintenance

Chạy hằng ngày:

```powershell
./ops/production/Invoke-Maintenance.ps1
./ops/production/Backup-Postgres.ps1
```

Windows dùng `Register-ScheduledTasks.ps1`. Linux dùng `cron.example` hoặc systemd timer.

## Restore drill

Thực hiện ít nhất mỗi tháng trên staging:

```powershell
./ops/production/Restore-Postgres.ps1 `
  -BackupFile ./backups/quan_ly_truyen-YYYYMMDDTHHMMSSZ.dump `
  -ConfirmDatabaseName quan_ly_truyen `
  -Confirm
```

Sau restore phải chạy postdeploy gate và Auth smoke test.

## Auth release checklist

- `LogoutAllCommandHandler` chỉ gọi persistence đúng một lần.
- Login rate limit, JWT blacklist và CSRF đều bật.
- Cookie Secure và HTTPS hoạt động qua Caddy.
- Refresh rotation/reuse test xanh.
- Change password/email, reset password và verify email gửi mail thật.
- Redis unavailable test xác nhận fail-closed.
- Audit/security event không chứa token, password hoặc secret.
- Admin MFA là gate bắt buộc trước khi cấp tài khoản admin production cho người dùng thật.
