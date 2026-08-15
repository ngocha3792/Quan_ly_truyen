# Production Runbook

## Release gate

1. CI phải xanh: lint, build, typecheck, unit, integration, E2E và dependency audit.
2. Backend và frontend production phải dùng full 40-character Git SHA; không dùng `latest`, branch tag hoặc tag mutable. Runtime và migrate backend phải cùng source SHA.
3. Tạo `.env.production` bằng `New-ProductionEnv.ps1`; không dùng file example.
4. Chạy `Deploy-Production.ps1` và không bỏ qua predeploy/postdeploy gate khi release thật.
5. Kiểm tra `/api/v1/health/live`, `/api/v1/health/ready`, worker heartbeat, recovery metrics, mail delivery và dashboard.
6. Sau khi hệ thống đã bootstrap backup lần đầu, `Test-RecoveryReadiness.ps1` phải xanh trước release định kỳ.

## External requirements

Các mục sau không thể được tự động hóa chỉ bằng repository:

- DNS A/AAAA của `APP_DOMAIN` trỏ đúng máy chủ và cổng 80/443 mở.
- SPF cho domain gửi mail.
- DKIM key/selector được cấu hình tại SMTP provider và DNS.
- DMARC được bật, ban đầu có thể dùng `p=none`, sau đó nâng chính sách.
- SMTP production cho phép From/Reply-To đã khai báo.
- Backup được sao chép sang storage khác máy chủ và được mã hóa.
- Alertmanager webhook phải trỏ tới hệ thống nhận cảnh báo production (incident/chat/on-call gateway) qua HTTPS.

## Deploy

```powershell
./ops/production/Deploy-Production.ps1
```

Server chỉ pull image đã được CI publish. `Deploy-Production.ps1` từ chối tag application không phải full Git SHA trong registry mode. Build trực tiếp trên server chỉ dùng cho staging/local qua `compose.production.build.yml`.

Kiểm tra Compose trước deploy mà không cần secret thật:

```powershell
npm run docker:prod:config:example
```

Frontend container chạy non-root trên cổng nội bộ `8080`, filesystem read-only và drop toàn bộ Linux capabilities trong production Compose. `recovery-metrics` chỉ đọc thư mục backup ở chế độ read-only và không nhận application secrets.

## Observability and alerting

Production observability gồm Prometheus, Alertmanager, Loki, Tempo, Alloy và Grafana. Alertmanager đọc webhook URL từ `ops/production/secrets/alert_webhook_url`; URL không nằm trong Git hoặc `.env.production`.

```powershell
npm run observability:config
npm run observability:up
npm run observability:smoke
```

Dashboard `Recovery Readiness` theo dõi backup RPO, off-site verification và tuổi restore drill. Alert critical phải được kiểm tra bằng receiver thật trước khi mở traffic production.

## Maintenance and backup

Chạy hằng ngày:

```powershell
./ops/production/Invoke-Maintenance.ps1
./ops/production/Backup-Postgres.ps1
```

Backup chỉ được ghi nhận thành công sau khi SHA-256 khớp, `pg_restore --list` đọc được archive và (khi bật off-site) Restic upload + repository check hoàn tất. Trạng thái cuối cùng nằm ở `backup-last-success.json`.

Windows dùng `Register-ScheduledTasks.ps1`. Linux dùng `cron.example` hoặc systemd timer.

## Restore drill and recovery gate

Mặc định mục tiêu là backup không cũ hơn 26 giờ (`BACKUP_RPO_HOURS=26`) và restore drill không cũ hơn 8 ngày (`RESTORE_DRILL_MAX_AGE_DAYS=8`). Chạy restore drill ít nhất mỗi tuần:

```powershell
./ops/production/Test-PostgresRestoreDrill.ps1
./ops/production/Test-RecoveryReadiness.ps1
```

Restore drill luôn lấy snapshot encrypted off-site, verify checksum/archive, restore vào PostgreSQL disposable và xác nhận Prisma migrations cùng các bảng `users`, `stories`, `chapters`, `outbox_events`.

Khi phải restore production thật:

```powershell
./ops/production/Restore-Postgres.ps1 `
  -BackupFile ./backups/quan_ly_truyen-YYYYMMDDTHHMMSSZ.dump `
  -ConfirmDatabaseName quan_ly_truyen `
  -Confirm
```

`Restore-Postgres.ps1` verify checksum/archive trước khi dừng API/worker và tạo safety backup mặc định trước thao tác destructive. Sau restore phải chạy postdeploy gate và Auth smoke test.

## Auth release checklist

- `LogoutAllCommandHandler` chỉ gọi persistence đúng một lần.
- Login rate limit, JWT blacklist và CSRF đều bật.
- Cookie Secure và HTTPS hoạt động qua Caddy.
- Refresh rotation/reuse test xanh.
- Change password/email, reset password và verify email gửi mail thật.
- Redis unavailable test xác nhận fail-closed.
- Audit/security event không chứa token, password hoặc secret.
- Admin MFA là gate bắt buộc trước khi cấp tài khoản admin production cho người dùng thật.
