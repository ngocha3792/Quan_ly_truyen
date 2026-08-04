[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$ErrorActionPreference = "Stop"
$ErrorActionPreference = "Stop"

# =============================================================================
# CONFIG
# =============================================================================

$ApiBase = "http://127.0.0.1:3000/api/v1"
$MailpitBase = "http://127.0.0.1:8025"

$RefreshCookieName = "refresh_token"
$CsrfCookieName = "csrf_token"

$RunId = "$(Get-Date -Format 'yyyyMMddHHmmss')$([guid]::NewGuid().ToString('N').Substring(0, 6))"

$Email = "auth.$RunId@example.test"
$NewEmail = "auth.changed.$RunId@example.test"
$Username = "auth_$RunId"

$Password1 = "StrongPass123!"
$Password2 = "ChangedPass456!"
$Password3 = "ResetPass789!"

# =============================================================================
# HELPERS
# =============================================================================

function Write-Step {
    param([string]$Message)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Write-Pass {
    param([string]$Message)

    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Get-ResponseData {
    param($Response)

    if (
        $null -ne $Response.Json -and
        $Response.Json.PSObject.Properties.Name -contains "data"
    ) {
        return $Response.Json.data
    }

    return $Response.Json
}

function Invoke-AuthApi {
    param(
        [Parameter(Mandatory)]
        [string]$Method,

        [Parameter(Mandatory)]
        [string]$Path,

        [object]$Body = $null,

        [hashtable]$Headers = @{},

        [string]$CookieHeader = $null,

        [int[]]$ExpectedStatus = @(200)
    )

    $headerFile = [IO.Path]::GetTempFileName()
    $bodyFile = [IO.Path]::GetTempFileName()
    $requestBodyFile = $null

    try {
        $curlArgs = @(
            "-sS",
            "-X", $Method,
            "-D", $headerFile,
            "-o", $bodyFile,
            "-w", "%{http_code}"
        )

        foreach ($entry in $Headers.GetEnumerator()) {
            $curlArgs += @(
                "-H",
                "$($entry.Key): $($entry.Value)"
            )
        }

        if ($CookieHeader) {
            $curlArgs += @(
                "-H",
                "Cookie: $CookieHeader"
            )
        }

        if ($null -ne $Body) {
            $requestBodyFile = [IO.Path]::GetTempFileName()

            $jsonBody = $Body | ConvertTo-Json -Depth 20 -Compress

            [IO.File]::WriteAllText(
                $requestBodyFile,
                $jsonBody,
                [Text.UTF8Encoding]::new($false)
            )

            $curlArgs += @(
                "-H",
                "Content-Type: application/json",
                "--data-binary",
                "@$requestBodyFile"
            )
        }

        $curlArgs += "$ApiBase$Path"

        $statusOutput = (& curl.exe @curlArgs | Out-String).Trim()

        if ($LASTEXITCODE -ne 0) {
            throw "curl thất bại với exit code $LASTEXITCODE"
        }

        $statusCode = [int]$statusOutput
        $rawHeaders = Get-Content $headerFile -Raw
        $rawBody = Get-Content $bodyFile -Raw

        $parsedJson = $null

        if (-not [string]::IsNullOrWhiteSpace($rawBody)) {
            try {
                $parsedJson = $rawBody | ConvertFrom-Json
            }
            catch {
                # Response không phải JSON, giữ raw body.
            }
        }

        if ($ExpectedStatus -notcontains $statusCode) {
            throw @"
HTTP request thất bại

Method:   $Method
URL:      $ApiBase$Path
Expected: $($ExpectedStatus -join ", ")
Actual:   $statusCode
Body:
$rawBody
"@
        }

        return [pscustomobject]@{
            Status  = $statusCode
            Headers = $rawHeaders
            RawBody = $rawBody
            Json    = $parsedJson
        }
    }
    finally {
        Remove-Item $headerFile -Force -ErrorAction SilentlyContinue
        Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue

        if ($requestBodyFile) {
            Remove-Item $requestBodyFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-AuthCookies {
    param(
        [Parameter(Mandatory)]
        $Response
    )

    $refreshPattern =
        '(?im)^Set-Cookie:\s*' +
        [regex]::Escape($RefreshCookieName) +
        '=([^;\r\n]+)'

    $csrfPattern =
        '(?im)^Set-Cookie:\s*' +
        [regex]::Escape($CsrfCookieName) +
        '=([^;\r\n]+)'

    $refreshMatch = [regex]::Match(
        $Response.Headers,
        $refreshPattern
    )

    $csrfMatch = [regex]::Match(
        $Response.Headers,
        $csrfPattern
    )

    if (-not $refreshMatch.Success) {
        throw "Response không chứa cookie $RefreshCookieName"
    }

    if (-not $csrfMatch.Success) {
        throw "Response không chứa cookie $CsrfCookieName"
    }

    $refreshCookieValue = $refreshMatch.Groups[1].Value
    $csrfCookieValue = $csrfMatch.Groups[1].Value

    $csrfToken = [Uri]::UnescapeDataString($csrfCookieValue)

    return [pscustomobject]@{
        RefreshValue = $refreshCookieValue
        CsrfValue    = $csrfCookieValue
        CsrfToken    = $csrfToken

        CookieHeader = (
            "$RefreshCookieName=$refreshCookieValue; " +
            "$CsrfCookieName=$csrfCookieValue"
        )
    }
}

function Wait-MailToken {
    param(
        [Parameter(Mandatory)]
        [string]$Recipient,

        [Parameter(Mandatory)]
        [datetime]$AfterUtc,

        [string]$ExpectedSubject = $null,

[Parameter(Mandatory)]
[string]$ExpectedPath,

        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $result = Invoke-RestMethod `
                -Method Get `
                -Uri "$MailpitBase/api/v1/messages?start=0&limit=100"

            $candidates = @()

            foreach ($summary in @($result.messages)) {
                $recipientAddresses = @(
                    $summary.To |
                        ForEach-Object { [string]$_.Address }
                )

                if ($recipientAddresses -notcontains $Recipient) {
                    continue
                }

                if (
    -not [string]::IsNullOrWhiteSpace($ExpectedSubject) -and
    [string]$summary.Subject -ne $ExpectedSubject
) {
    Write-Host "Bỏ qua kiểm tra subject do có thể lỗi encoding: $($summary.Subject)" `
        -ForegroundColor DarkYellow
}

                try {
                    $createdUtc = [DateTimeOffset]::Parse(
                        [string]$summary.Created
                    ).UtcDateTime

                    if ($createdUtc -lt $AfterUtc.AddSeconds(-5)) {
                        continue
                    }
                }
                catch {
                    continue
                }

                $candidates += $summary
            }

            $candidates = @(
                $candidates |
                    Sort-Object {
                        [DateTimeOffset]::Parse(
                            [string]$_.Created
                        ).UtcDateTime
                    } -Descending
            )

            foreach ($summary in $candidates) {
                $message = Invoke-RestMethod `
                    -Method Get `
                    -Uri "$MailpitBase/api/v1/message/$($summary.ID)"

                $content = [Net.WebUtility]::HtmlDecode(
                    "$($message.Text)`n$($message.HTML)"
                )

                $urlMatches = [regex]::Matches(
                    $content,
                    'https?://[^\s"''<>]+'
                )

                foreach ($urlMatch in $urlMatches) {
                    $rawUrl = $urlMatch.Value.TrimEnd(
                        '.',
                        ',',
                        ';',
                        ')',
                        ']'
                    )

                    try {
                        $uri = [Uri]$rawUrl
                    }
                    catch {
                        continue
                    }

                    if ($uri.AbsolutePath -ne $ExpectedPath) {
                        continue
                    }

                    $tokenMatch = [regex]::Match(
                        $uri.Query.TrimStart('?'),
                        '(?:^|&)token=([^&]+)'
                    )

                    if (-not $tokenMatch.Success) {
                        continue
                    }

                    $token = [Uri]::UnescapeDataString(
                        $tokenMatch.Groups[1].Value
                    )

                    if ($token -notmatch '^[A-Za-z0-9_-]{32,512}$') {
                        continue
                    }

                    Write-Host "Mail được chọn:" -ForegroundColor DarkCyan
                    Write-Host "  Subject: $($summary.Subject)"
                    Write-Host "  Created: $($summary.Created)"
                    Write-Host "  Path:    $ExpectedPath"
                    Write-Host "  Token:   $($token.Substring(0, 8))...$($token.Substring($token.Length - 8))"

                    return $token
                }
            }
        }
        catch {
            Write-Host "Đang chờ Mailpit/worker: $($_.Exception.Message)" `
                -ForegroundColor DarkYellow
        }

        Start-Sleep -Seconds 1
    }

    throw @"
Không tìm thấy đúng email token.

Recipient: $Recipient
Subject:   $ExpectedSubject
Path:      $ExpectedPath
Timeout:   $TimeoutSeconds giây
"@
}

# =============================================================================
# PRECHECK
# =============================================================================

Write-Step "Kiểm tra API và Mailpit"

$health = Invoke-RestMethod `
    -Method Get `
    -Uri "$ApiBase/health/live"

if ($health.status -ne "ok") {
    throw "API health check không trả status=ok"
}

Invoke-WebRequest `
    -Method Get `
    -Uri "$MailpitBase/readyz" `
    -UseBasicParsing |
    Out-Null

Write-Pass "API đang chạy"
Write-Pass "Mailpit đang chạy"

Write-Host "Email test: $Email"
Write-Host "Email mới:  $NewEmail"
Write-Host "Username:   $Username"

# =============================================================================
# 1. REGISTER
# =============================================================================

Write-Step "1. Register"

$registerTime = [datetime]::UtcNow

$registerResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/register" `
    -Headers @{
        "x-idempotency-key" = [guid]::NewGuid().ToString()
    } `
    -Body @{
        email       = $Email
        username    = $Username
        password    = $Password1
        displayName = "PowerShell Auth Test"
    } `
    -ExpectedStatus @(201)

$registered = Get-ResponseData $registerResponse

if (-not $registered.verificationRequired) {
    throw "Register không yêu cầu verification"
}

Write-Pass "Đăng ký thành công: $($registered.id)"

# =============================================================================
# 2. VERIFY EMAIL
# =============================================================================

Write-Step "2. Đọc email xác minh từ Mailpit"
$verificationToken = Wait-MailToken `
    -Recipient $Email `
    -AfterUtc $registerTime `
    -ExpectedSubject "Xác thực tài khoản Quan Ly Truyen" `
    -ExpectedPath "/verify-email"

Write-Pass "Đã lấy verification token"

$verifyResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/verify-email" `
    -Body @{
        token = $verificationToken
    } `
    -ExpectedStatus @(200)

$verified = Get-ResponseData $verifyResponse

if (-not $verified.emailVerified) {
    throw "Email chưa được xác minh"
}

Write-Pass "Email đã được xác minh"

# =============================================================================
# 3. LOGIN FIRST SESSION
# =============================================================================

Write-Step "3. Login session thứ nhất"

$login1Response = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/login" `
    -Body @{
        identifier = $Email
        password   = $Password1
        deviceId   = [guid]::NewGuid().ToString()
        deviceName = "PowerShell First Device"
    } `
    -ExpectedStatus @(200)

$login1 = Get-ResponseData $login1Response
$auth1 = Get-AuthCookies $login1Response

$accessToken1 = $login1.accessToken
$sessionId1 = $login1.sessionId

Write-Pass "Login thành công"
Write-Host "Session 1: $sessionId1"

# =============================================================================
# 4. /ME
# =============================================================================

Write-Step "4. Kiểm tra /auth/me"

$meResponse = Invoke-AuthApi `
    -Method GET `
    -Path "/auth/me" `
    -Headers @{
        Authorization = "Bearer $accessToken1"
    } `
    -ExpectedStatus @(200)

$me = Get-ResponseData $meResponse

if ($me.email -ne $Email) {
    throw "/me trả sai email"
}

if (-not $me.emailVerified) {
    throw "/me cho biết email chưa verify"
}

Write-Pass "/auth/me hợp lệ"
Write-Host "User ID:    $($me.id)"
Write-Host "Session ID: $($me.sessionId)"
Write-Host "Roles:      $($me.roles -join ', ')"

# =============================================================================
# 5. SECOND LOGIN + SESSION REVOCATION
# =============================================================================

Write-Step "5. Tạo session thứ hai"

$login2Response = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/login" `
    -Body @{
        identifier = $Email
        password   = $Password1
        deviceId   = [guid]::NewGuid().ToString()
        deviceName = "PowerShell Second Device"
    } `
    -ExpectedStatus @(200)

$login2 = Get-ResponseData $login2Response
$accessToken2 = $login2.accessToken
$sessionId2 = $login2.sessionId

Write-Pass "Session thứ hai đã được tạo"
Write-Host "Session 2: $sessionId2"

$sessionsResponse = Invoke-AuthApi `
    -Method GET `
    -Path "/auth/sessions" `
    -Headers @{
        Authorization = "Bearer $accessToken1"
    } `
    -ExpectedStatus @(200)

$sessions = Get-ResponseData $sessionsResponse

$sessions.sessions |
    Select-Object id, isCurrent, deviceName, createdAt, expiresAt |
    Format-Table -AutoSize

if ([int]$sessions.total -lt 2) {
    throw "Không tìm thấy đủ hai session"
}

Invoke-AuthApi `
    -Method DELETE `
    -Path "/auth/sessions/$sessionId2" `
    -Headers @{
        Authorization = "Bearer $accessToken1"
    } `
    -ExpectedStatus @(204) |
    Out-Null

Write-Pass "Đã revoke session thứ hai"

Invoke-AuthApi `
    -Method GET `
    -Path "/auth/me" `
    -Headers @{
        Authorization = "Bearer $accessToken2"
    } `
    -ExpectedStatus @(401) |
    Out-Null

Write-Pass "Access token của session bị revoke đã bị từ chối"

# =============================================================================
# 6. CSRF NEGATIVE TESTS
# =============================================================================

Write-Step "6. Kiểm tra CSRF"

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -CookieHeader $auth1.CookieHeader `
    -ExpectedStatus @(403) |
    Out-Null

Write-Pass "Refresh thiếu CSRF header bị từ chối"

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -Headers @{
        "x-csrf-token" = $auth1.CsrfToken
        Origin         = "https://evil.example"
    } `
    -CookieHeader $auth1.CookieHeader `
    -ExpectedStatus @(403) |
    Out-Null

Write-Pass "Origin không tin cậy bị từ chối"

# =============================================================================
# 7. REFRESH ROTATION
# =============================================================================

Write-Step "7. Refresh-token rotation"

$oldCookieHeader = $auth1.CookieHeader

$refreshResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -Headers @{
        "x-csrf-token" = $auth1.CsrfToken
    } `
    -CookieHeader $auth1.CookieHeader `
    -ExpectedStatus @(200)

$refreshData = Get-ResponseData $refreshResponse
$auth1 = Get-AuthCookies $refreshResponse
$accessToken1 = $refreshData.accessToken

if ($auth1.CookieHeader -eq $oldCookieHeader) {
    throw "Refresh cookie không được rotate"
}

Write-Pass "Refresh token và CSRF token đã được rotate"

# =============================================================================
# 8. CHANGE PASSWORD
# =============================================================================

Write-Step "8. Change password"

$changePasswordResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/change-password" `
    -Headers @{
        Authorization = "Bearer $accessToken1"
    } `
    -Body @{
        currentPassword = $Password1
        newPassword     = $Password2
    } `
    -ExpectedStatus @(200)

$changePassword = Get-ResponseData $changePasswordResponse

if (-not $changePassword.passwordChanged) {
    throw "Password chưa được thay đổi"
}

Write-Pass "Password đã được thay đổi"

Invoke-AuthApi `
    -Method GET `
    -Path "/auth/me" `
    -Headers @{
        Authorization = "Bearer $accessToken1"
    } `
    -ExpectedStatus @(401) |
    Out-Null

Write-Pass "Access token cũ đã bị invalidated"

$refreshAfterPasswordResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -Headers @{
        "x-csrf-token" = $auth1.CsrfToken
    } `
    -CookieHeader $auth1.CookieHeader `
    -ExpectedStatus @(200)

$refreshAfterPassword = Get-ResponseData $refreshAfterPasswordResponse
$auth1 = Get-AuthCookies $refreshAfterPasswordResponse
$accessToken1 = $refreshAfterPassword.accessToken

Write-Pass "Current refresh session vẫn hoạt động sau change-password"

# =============================================================================
# 9. FORGOT + RESET PASSWORD
# =============================================================================

Write-Step "9. Forgot password"

$forgotTime = [datetime]::UtcNow

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/forgot-password" `
    -Body @{
        email = $Email
    } `
    -ExpectedStatus @(202) |
    Out-Null

$resetToken = Wait-MailToken `
    -Recipient $Email `
    -AfterUtc $forgotTime `
    -ExpectedSubject "Đặt lại mật khẩu Quan Ly Truyen" `
    -ExpectedPath "/reset-password"

Write-Pass "Đã lấy password reset token"

$resetResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/reset-password" `
    -Body @{
        token       = $resetToken
        newPassword = $Password3
    } `
    -ExpectedStatus @(200)

$resetResult = Get-ResponseData $resetResponse

if (-not $resetResult.passwordReset) {
    throw "Reset password thất bại"
}

Write-Pass "Reset password thành công"

# =============================================================================
# 10. LOGIN WITH RESET PASSWORD
# =============================================================================

Write-Step "10. Login bằng password mới"

$loginAfterResetResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/login" `
    -Body @{
        identifier = $Email
        password   = $Password3
        deviceId   = [guid]::NewGuid().ToString()
        deviceName = "PowerShell After Reset"
    } `
    -ExpectedStatus @(200)

$loginAfterReset = Get-ResponseData $loginAfterResetResponse
$authAfterReset = Get-AuthCookies $loginAfterResetResponse
$accessAfterReset = $loginAfterReset.accessToken

Write-Pass "Login bằng password reset thành công"

# =============================================================================
# 11. CHANGE EMAIL
# =============================================================================

Write-Step "11. Request và confirm change email"

$changeEmailTime = [datetime]::UtcNow
$idempotencyKey = [guid]::NewGuid().ToString()

Write-Host "Đang gọi POST /auth/change-email..." `
    -ForegroundColor Yellow

$stopwatch = [Diagnostics.Stopwatch]::StartNew()

$changeEmailResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/change-email" `
    -Headers @{
        Authorization       = "Bearer $accessAfterReset"
        "x-idempotency-key" = $idempotencyKey
    } `
    -Body @{
        currentPassword = $Password3
        newEmail        = $NewEmail
    } `
    -ExpectedStatus @(202)

$stopwatch.Stop()

$changeEmailRequest = Get-ResponseData $changeEmailResponse

if (-not $changeEmailRequest.emailChangeRequested) {
    throw @"
Backend không xác nhận yêu cầu đổi email.

Response:
$($changeEmailResponse.RawBody)
"@
}

if (
    $changeEmailRequest.pendingEmail -and
    $changeEmailRequest.pendingEmail -ne $NewEmail
) {
    throw @"
Backend lưu sai pending email.

Pending email: $($changeEmailRequest.pendingEmail)
Email mong đợi: $NewEmail
"@
}

Write-Pass "Request change email trả HTTP 202 sau $([math]::Round($stopwatch.Elapsed.TotalSeconds, 2)) giây"

Write-Host "Pending email: $($changeEmailRequest.pendingEmail)"
Write-Host "Đang chờ worker gửi mail tới $NewEmail..." `
    -ForegroundColor Yellow

$emailChangeToken = Wait-MailToken `
    -Recipient $NewEmail `
    -AfterUtc $changeEmailTime `
    -ExpectedPath "/change-email/confirm" `
    -TimeoutSeconds 120
Write-Pass "Đã lấy đúng email change token"

# Quan trọng: script cũ thiếu toàn bộ đoạn confirm này.
Write-Host "Đang gọi POST /auth/change-email/confirm..." `
    -ForegroundColor Yellow

$confirmEmailResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/change-email/confirm" `
    -Body @{
        token = $emailChangeToken
    } `
    -ExpectedStatus @(200)

$confirmEmail = Get-ResponseData $confirmEmailResponse

Write-Host "Confirm response:"
Write-Host $confirmEmailResponse.RawBody

if (-not $confirmEmail.emailChanged) {
    throw @"
Backend không xác nhận email đã được thay đổi.

Response:
$($confirmEmailResponse.RawBody)
"@
}

if (
    $confirmEmail.PSObject.Properties.Name -contains "email" -and
    -not [string]::IsNullOrWhiteSpace([string]$confirmEmail.email) -and
    [string]$confirmEmail.email -ne $NewEmail
) {
    throw @"
Token đã đổi sang email không đúng.

Email backend trả: $($confirmEmail.email)
Email mong đợi:    $NewEmail
"@
}

if (
    $confirmEmail.PSObject.Properties.Name -contains "previousEmail" -and
    -not [string]::IsNullOrWhiteSpace([string]$confirmEmail.previousEmail) -and
    [string]$confirmEmail.previousEmail -ne $Email
) {
    throw @"
Token đổi email không thuộc đúng tài khoản hiện tại.

Previous email backend trả: $($confirmEmail.previousEmail)
Email ban đầu mong đợi:      $Email
"@
}

Write-Pass "Đã confirm yêu cầu đổi email"

# Confirm change-email phải revoke các session cũ.
Invoke-AuthApi `
    -Method GET `
    -Path "/auth/me" `
    -Headers @{
        Authorization = "Bearer $accessAfterReset"
    } `
    -ExpectedStatus @(401) |
    Out-Null

Write-Pass "Access token cũ đã bị vô hiệu hóa sau change-email"

# =============================================================================
# 12. LOGIN WITH NEW EMAIL
# =============================================================================

Write-Step "12. Kiểm tra tài khoản sau change-email"

Write-Host "Đăng nhập bằng username để kiểm tra dữ liệu tài khoản..." `
    -ForegroundColor Yellow

$loginByUsernameResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/login" `
    -Body @{
        identifier = $Username
        password   = $Password3
        deviceId   = [guid]::NewGuid().ToString()
        deviceName = "PowerShell Username Diagnostic"
    } `
    -ExpectedStatus @(200)

$loginByUsername = Get-ResponseData $loginByUsernameResponse
$accessByUsername = $loginByUsername.accessToken

Write-Pass "Login bằng username thành công"

$meAfterEmailChangeResponse = Invoke-AuthApi `
    -Method GET `
    -Path "/auth/me" `
    -Headers @{
        Authorization = "Bearer $accessByUsername"
    } `
    -ExpectedStatus @(200)

$meAfterEmailChange = Get-ResponseData $meAfterEmailChangeResponse

Write-Host ""
Write-Host "Email hiện tại trong database/API: $($meAfterEmailChange.email)"
Write-Host "Email mong đợi:                    $NewEmail"

if ($meAfterEmailChange.email -ne $NewEmail) {
    throw @"
Endpoint confirm trả thành công nhưng database chưa đổi email.

Email hiện tại: $($meAfterEmailChange.email)
Email mong đợi: $NewEmail

Đây là lỗi backend trong handler confirm-change-email,
không còn là lỗi lấy token hoặc lỗi PowerShell.
"@
}

Write-Pass "/auth/me đã trả đúng email mới"

Write-Host "Đang đăng nhập trực tiếp bằng email mới..." `
    -ForegroundColor Yellow

$loginNewEmailResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/login" `
    -Body @{
        identifier = $NewEmail
        password   = $Password3
        deviceId   = [guid]::NewGuid().ToString()
        deviceName = "PowerShell New Email"
    } `
    -ExpectedStatus @(200)

$loginNewEmail = Get-ResponseData $loginNewEmailResponse
$authNewEmail = Get-AuthCookies $loginNewEmailResponse
$accessNewEmail = $loginNewEmail.accessToken

Write-Pass "Login bằng email mới thành công"

# =============================================================================
# 13. SECURITY EVENTS
# =============================================================================

Write-Step "13. Security events"

$securityResponse = Invoke-AuthApi `
    -Method GET `
    -Path "/auth/security-events?limit=20" `
    -Headers @{
        Authorization = "Bearer $accessNewEmail"
    } `
    -ExpectedStatus @(200)

$securityEvents = Get-ResponseData $securityResponse

$securityEvents.events |
    Select-Object action, ipAddress, createdAt |
    Format-Table -AutoSize

Write-Pass "Đọc security events thành công"

# =============================================================================
# 14. JWT BLACKLIST
# =============================================================================

Write-Step "14. Revoke access token / JWT blacklist"

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/revoke-access-token" `
    -Headers @{
        Authorization = "Bearer $accessNewEmail"
    } `
    -ExpectedStatus @(204) |
    Out-Null

Invoke-AuthApi `
    -Method GET `
    -Path "/auth/me" `
    -Headers @{
        Authorization = "Bearer $accessNewEmail"
    } `
    -ExpectedStatus @(401) |
    Out-Null

Write-Pass "Access token đã bị blacklist"

$refreshAfterBlacklistResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -Headers @{
        "x-csrf-token" = $authNewEmail.CsrfToken
    } `
    -CookieHeader $authNewEmail.CookieHeader `
    -ExpectedStatus @(200)

$refreshAfterBlacklist = Get-ResponseData $refreshAfterBlacklistResponse
$authNewEmail = Get-AuthCookies $refreshAfterBlacklistResponse
$accessNewEmail = $refreshAfterBlacklist.accessToken

Write-Pass "Refresh tạo access token mới thành công"

# =============================================================================
# 15. LOGOUT
# =============================================================================

Write-Step "15. Logout"

$cookieBeforeLogout = $authNewEmail.CookieHeader
$csrfBeforeLogout = $authNewEmail.CsrfToken

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/logout" `
    -Headers @{
        "x-csrf-token" = $csrfBeforeLogout
    } `
    -CookieHeader $cookieBeforeLogout `
    -ExpectedStatus @(204) |
    Out-Null

Write-Pass "Logout thành công"

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -Headers @{
        "x-csrf-token" = $csrfBeforeLogout
    } `
    -CookieHeader $cookieBeforeLogout `
    -ExpectedStatus @(401) |
    Out-Null

Write-Pass "Refresh token sau logout đã bị từ chối"

# =============================================================================
# 16. LOGOUT ALL
# =============================================================================

Write-Step "16. Login lại và logout-all"

$finalLoginResponse = Invoke-AuthApi `
    -Method POST `
    -Path "/auth/login" `
    -Body @{
        identifier = $NewEmail
        password   = $Password3
        deviceId   = [guid]::NewGuid().ToString()
        deviceName = "PowerShell Logout All"
    } `
    -ExpectedStatus @(200)

$finalLogin = Get-ResponseData $finalLoginResponse
$finalAuth = Get-AuthCookies $finalLoginResponse
$finalAccess = $finalLogin.accessToken

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/logout-all" `
    -Headers @{
        Authorization = "Bearer $finalAccess"
    } `
    -ExpectedStatus @(204) |
    Out-Null

Write-Pass "Logout-all thành công"

Invoke-AuthApi `
    -Method POST `
    -Path "/auth/refresh" `
    -Headers @{
        "x-csrf-token" = $finalAuth.CsrfToken
    } `
    -CookieHeader $finalAuth.CookieHeader `
    -ExpectedStatus @(401) |
    Out-Null

Write-Pass "Refresh token sau logout-all đã bị từ chối"

# =============================================================================
# DONE
# =============================================================================

Write-Host ""
Write-Host "############################################################" -ForegroundColor Green
Write-Host "#                                                          #" -ForegroundColor Green
Write-Host "#       TOÀN BỘ AUTH POWERSHELL FLOW ĐÃ PASS               #" -ForegroundColor Green
Write-Host "#                                                          #" -ForegroundColor Green
Write-Host "############################################################" -ForegroundColor Green

Write-Host ""
Write-Host "Tài khoản cuối cùng:"
Write-Host "Email:    $NewEmail"
Write-Host "Password: $Password3"