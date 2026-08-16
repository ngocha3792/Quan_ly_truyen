# Audit Log read-side

The admin Audit Log capability is read-only. `AuditLog` remains append-only and the admin API exposes only `GET /admin/audit-logs` and `GET /admin/audit-logs/:id`.

Stored audit JSON is treated as untrusted historical data. Detail responses recursively redact credential/token/secret fields, bound nested payloads, mask IP addresses, truncate User-Agent values, and compute before/after changes only after sanitization. Audit list responses intentionally exclude `oldValues`, `newValues`, `metadata`, IP address, and User-Agent.

AuditLog currently has **no automatic retention or purge policy**. Retention/archival is a future compliance and operations decision; Phase 4 does not delete historical audit records.

Audit data can contain administrator identity, masked client network context, User-Agent text, and business metadata. Access is restricted by the `audit-log.read` permission and is not exposed through public or author endpoints.
