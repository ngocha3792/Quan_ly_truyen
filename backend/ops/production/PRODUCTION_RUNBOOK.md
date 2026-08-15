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

## Staging release flow

Staging chạy cùng production Compose nhưng bắt buộc dùng project name, domain, database volume và secret riêng. Tối thiểu `.env.staging` phải có:

```text
PRODUCTION_ENV_FILE=.env.staging
COMPOSE_PROJECT_NAME=quan-ly-truyen-staging
DEPLOYMENT_ENVIRONMENT=staging
APP_DOMAIN=staging.example.com
APP_PUBLIC_URL=https://staging.example.com
```

Không dùng chung `DEPLOY_PATH`, `.env`, PostgreSQL volume hoặc `ops/production/secrets` giữa GitHub Environment `staging` và `production`.

Release thủ công trên host:

```powershell
./ops/production/Invoke-Release.ps1 `
  -EnvironmentName staging `
  -SourceSha <FULL_40_CHAR_SHA> `
  -DeploymentMode Registry
```

`Invoke-Release.ps1` cập nhật đồng thời backend/frontend image tag, serialize deployment bằng lock file, chạy production gate, external smoke test và ghi trạng thái vào `ops/production/.deployment-state/staging`.

## GitHub deployment environments

Workflow `Deploy Environment` yêu cầu GitHub Environments `staging` và `production`. Mỗi environment cấu hình riêng các secrets sau:

```text
DEPLOY_HOST
DEPLOY_PORT                 # optional, mặc định 22
DEPLOY_USER
DEPLOY_PATH                 # absolute Linux path, không có whitespace
DEPLOY_SSH_PRIVATE_KEY
DEPLOY_KNOWN_HOSTS          # pinned known_hosts entry; không disable host-key checking
```

Deployment host phải có Docker Engine + Docker Compose plugin và PowerShell 7 (`pwsh`). `DEPLOY_PATH` của staging và production phải khác nhau. Production environment nên bật required reviewers để mọi release/rollback cần approval.

Registry deployment chỉ chấp nhận exact SHA đã xanh trên `main` và yêu cầu đủ ba immutable images:

```text
ghcr.io/<owner>/quan-ly-truyen-backend:<SHA>
ghcr.io/<owner>/quan-ly-truyen-backend-migrate:<SHA>
ghcr.io/<owner>/quan-ly-truyen-frontend:<SHA>
```

Workflow copy source deployment tooling nhưng giữ nguyên `.env.production`, `.env.staging`, backup, secret và deployment-state trên host.

## Production release

Production luôn dùng Registry mode:

```powershell
./ops/production/Invoke-Release.ps1 `
  -EnvironmentName production `
  -SourceSha <FULL_40_CHAR_SHA> `
  -DeploymentMode Registry
```

Khi đã có release hiện tại, script tạo verified PostgreSQL backup và chạy recovery-readiness gate trước khi thay image. Sau deploy, smoke gate gọi:

```text
/health
/api/v1/health/live
/api/v1/health/ready
/robots.txt
```

Release thành công ghi `current.json`, `previous.json` và immutable history record. Nếu deploy fail, image tags trong env file được phục hồi nhưng container có thể đã partial-update; phải kiểm tra `docker compose ps -a` trước khi retry.

## Application rollback

Rollback application không tự rollback database. Với production phải xác nhận schema/data hiện tại backward-compatible với target SHA:

```powershell
./ops/production/Invoke-Rollback.ps1 `
  -EnvironmentName production `
  -TargetSha <PREVIOUS_FULL_40_CHAR_SHA> `
  -ConfirmDatabaseIsBackwardCompatible
```

Script tạo safety backup trước production rollback, pull immutable target images, deploy, chạy postdeploy gate và external smoke test. Nếu migration destructive làm database không còn backward-compatible, không dùng application rollback đơn thuần; thực hiện database recovery theo phần `Restore drill and recovery gate`.

GitHub workflow `Rollback Environment` cũng yêu cầu explicit target SHA và production approval. Không dùng mutable tag như `latest`, branch name hoặc release alias để rollback.
