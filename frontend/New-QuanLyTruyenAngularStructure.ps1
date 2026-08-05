[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = (Get-Location).Path,

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-DirectorySafe {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Host "[DIR ] $Path"
    }
}

function New-FileSafe {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $false)][AllowEmptyString()][string]$Content = ''
    )

    $fullPath = Join-Path $ProjectRoot $RelativePath
    $parent = Split-Path -Parent $fullPath
    New-DirectorySafe -Path $parent

    if ((Test-Path -LiteralPath $fullPath -PathType Leaf) -and -not $Force) {
        Write-Host "[SKIP] $RelativePath"
        return
    }

    Set-Content -LiteralPath $fullPath -Value $Content -Encoding UTF8
    Write-Host "[FILE] $RelativePath"
}

function New-ComponentSkeleton {
    param([Parameter(Mandatory = $true)][string]$BasePath)

    New-FileSafe -RelativePath "$BasePath.component.ts" -Content "// TODO: implement $([System.IO.Path]::GetFileName($BasePath)) component.`n"
    New-FileSafe -RelativePath "$BasePath.component.html" -Content "<!-- TODO: implement $([System.IO.Path]::GetFileName($BasePath)) view -->`n"
    New-FileSafe -RelativePath "$BasePath.component.scss" -Content "// Component styles.`n"
    New-FileSafe -RelativePath "$BasePath.component.spec.ts" -Content "// TODO: add component tests.`n"
}

function Get-PlaceholderContent {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $name = [System.IO.Path]::GetFileName($RelativePath)
    $extension = [System.IO.Path]::GetExtension($RelativePath).ToLowerInvariant()

    if ($extension -eq '.json') {
        return "{}`n"
    }

    if ($extension -eq '.html') {
        return "<!-- TODO: implement $RelativePath -->`n"
    }

    if ($extension -in @('.yml', '.yaml', '.md', '.env') -or
        $name -in @('Dockerfile', '.dockerignore', '.env.example', 'nginx.conf')) {
        return "# TODO: implement $RelativePath`n"
    }

    return "// TODO: implement $RelativePath`n"
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
New-DirectorySafe -Path $ProjectRoot

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'angular.json'))) {
    Write-Warning @"
Không tìm thấy angular.json tại:
$ProjectRoot

Script vẫn tạo cấu trúc, nhưng nên chạy nó trong project đã được tạo bởi Angular CLI:
  npx @angular/cli new quan-ly-truyen-frontend --routing --style=scss --strict --standalone --skip-git
"@
}

# -----------------------------------------------------------------------------
# Directories
# -----------------------------------------------------------------------------
$directories = @(
    '.github/workflows',
    'docs/adr',
    'docs/api',
    'docs/architecture',
    'e2e/fixtures',
    'e2e/pages',
    'e2e/specs/auth',
    'e2e/specs/public',
    'e2e/specs/reader',
    'e2e/specs/account',
    'e2e/specs/author-studio',
    'e2e/specs/admin',
    'e2e/utils',
    'public/config',
    'public/assets/fonts',
    'public/assets/icons',
    'public/assets/images/common',
    'public/assets/images/placeholders',
    'public/assets/images/branding',
    'scripts',
    'src/environments',
    'src/styles/base',
    'src/styles/components',
    'src/styles/themes',
    'src/styles/tokens',
    'src/styles/utilities',

    'src/app/core/auth/guards',
    'src/app/core/auth/services',
    'src/app/core/auth/state',
    'src/app/core/config',
    'src/app/core/errors',
    'src/app/core/http/contracts',
    'src/app/core/http/interceptors',
    'src/app/core/http/tokens',
    'src/app/core/i18n',
    'src/app/core/logging',
    'src/app/core/observability',
    'src/app/core/routing',
    'src/app/core/security',
    'src/app/core/storage',

    'src/app/layouts/public-layout/components/public-header',
    'src/app/layouts/public-layout/components/public-footer',
    'src/app/layouts/auth-layout',
    'src/app/layouts/reader-layout/components/reader-toolbar',
    'src/app/layouts/account-layout/components/account-sidebar',
    'src/app/layouts/author-layout/components/author-sidebar',
    'src/app/layouts/admin-layout/components/admin-sidebar',
    'src/app/layouts/admin-layout/components/admin-header',
    'src/app/layouts/error-layout',

    'src/app/shared/constants',
    'src/app/shared/directives',
    'src/app/shared/forms/controls',
    'src/app/shared/forms/errors',
    'src/app/shared/forms/validators',
    'src/app/shared/pipes',
    'src/app/shared/testing/builders',
    'src/app/shared/testing/mocks',
    'src/app/shared/testing/providers',
    'src/app/shared/types',
    'src/app/shared/utils',

    'src/app/domains/auth/contracts/requests',
    'src/app/domains/auth/contracts/responses',
    'src/app/domains/auth/data-access',
    'src/app/domains/auth/mappers',
    'src/app/domains/auth/models',
    'src/app/domains/auth/state',

    'src/app/domains/users/contracts',
    'src/app/domains/users/data-access',
    'src/app/domains/users/mappers',
    'src/app/domains/users/models',
    'src/app/domains/users/state',

    'src/app/domains/authors/contracts',
    'src/app/domains/authors/data-access',
    'src/app/domains/authors/mappers',
    'src/app/domains/authors/models',
    'src/app/domains/authors/state',

    'src/app/domains/media/contracts',
    'src/app/domains/media/data-access',
    'src/app/domains/media/mappers',
    'src/app/domains/media/models',
    'src/app/domains/media/services',
    'src/app/domains/media/state',

    'src/app/domains/stories/contracts',
    'src/app/domains/stories/data-access',
    'src/app/domains/stories/mappers',
    'src/app/domains/stories/models',
    'src/app/domains/stories/state',

    'src/app/domains/chapters/contracts',
    'src/app/domains/chapters/data-access',
    'src/app/domains/chapters/mappers',
    'src/app/domains/chapters/models',
    'src/app/domains/chapters/state',

    'src/app/domains/taxonomy/contracts',
    'src/app/domains/taxonomy/data-access',
    'src/app/domains/taxonomy/models',
    'src/app/domains/taxonomy/state',

    'src/app/domains/library/contracts',
    'src/app/domains/library/data-access',
    'src/app/domains/library/models',
    'src/app/domains/library/state',

    'src/app/domains/engagement/contracts',
    'src/app/domains/engagement/data-access',
    'src/app/domains/engagement/models',
    'src/app/domains/engagement/state',

    'src/app/domains/reading/contracts',
    'src/app/domains/reading/data-access',
    'src/app/domains/reading/models',
    'src/app/domains/reading/state',

    'src/app/domains/moderation/contracts',
    'src/app/domains/moderation/data-access',
    'src/app/domains/moderation/models',
    'src/app/domains/moderation/state',

    'src/app/domains/notifications/contracts',
    'src/app/domains/notifications/data-access',
    'src/app/domains/notifications/models',
    'src/app/domains/notifications/state',

    'src/app/domains/audit/contracts',
    'src/app/domains/audit/data-access',
    'src/app/domains/audit/models',
    'src/app/domains/audit/state',

    'src/app/domains/analytics/contracts',
    'src/app/domains/analytics/data-access',
    'src/app/domains/analytics/models',
    'src/app/domains/analytics/state',

    'src/app/features/auth/components/auth-card',
    'src/app/features/auth/components/password-strength',
    'src/app/features/auth/components/verification-notice',
    'src/app/features/auth/pages/login-page',
    'src/app/features/auth/pages/register-page',
    'src/app/features/auth/pages/forgot-password-page',
    'src/app/features/auth/pages/reset-password-page',
    'src/app/features/auth/pages/verify-email-page',
    'src/app/features/auth/pages/change-email-confirm-page',

    'src/app/features/public/components/story-card',
    'src/app/features/public/components/story-grid',
    'src/app/features/public/components/story-filter',
    'src/app/features/public/components/chapter-list',
    'src/app/features/public/components/author-card',
    'src/app/features/public/pages/home-page',
    'src/app/features/public/pages/discover-page',
    'src/app/features/public/pages/search-page',
    'src/app/features/public/pages/story-detail-page',
    'src/app/features/public/pages/author-detail-page',
    'src/app/features/public/pages/category-detail-page',
    'src/app/features/public/pages/tag-detail-page',

    'src/app/features/reader/components/chapter-content',
    'src/app/features/reader/components/reader-settings',
    'src/app/features/reader/components/chapter-navigation',
    'src/app/features/reader/components/reading-progress',
    'src/app/features/reader/pages/chapter-reader-page',

    'src/app/features/account/components/profile-form',
    'src/app/features/account/components/avatar-uploader',
    'src/app/features/account/components/session-card',
    'src/app/features/account/components/security-event-list',
    'src/app/features/account/components/library-filter',
    'src/app/features/account/pages/account-overview-page',
    'src/app/features/account/pages/profile-page',
    'src/app/features/account/pages/security-page',
    'src/app/features/account/pages/sessions-page',
    'src/app/features/account/pages/change-password-page',
    'src/app/features/account/pages/change-email-page',
    'src/app/features/account/pages/library-page',
    'src/app/features/account/pages/reading-history-page',
    'src/app/features/account/pages/notifications-page',
    'src/app/features/account/pages/notification-preferences-page',

    'src/app/features/author-studio/components/story-form',
    'src/app/features/author-studio/components/story-cover-uploader',
    'src/app/features/author-studio/components/story-status-badge',
    'src/app/features/author-studio/components/contributor-table',
    'src/app/features/author-studio/components/chapter-form',
    'src/app/features/author-studio/components/chapter-editor',
    'src/app/features/author-studio/components/chapter-version-list',
    'src/app/features/author-studio/components/submission-timeline',
    'src/app/features/author-studio/pages/author-dashboard-page',
    'src/app/features/author-studio/pages/story-list-page',
    'src/app/features/author-studio/pages/story-create-page',
    'src/app/features/author-studio/pages/story-edit-page',
    'src/app/features/author-studio/pages/story-manage-page',
    'src/app/features/author-studio/pages/contributors-page',
    'src/app/features/author-studio/pages/chapter-list-page',
    'src/app/features/author-studio/pages/chapter-create-page',
    'src/app/features/author-studio/pages/chapter-edit-page',
    'src/app/features/author-studio/pages/chapter-versions-page',
    'src/app/features/author-studio/pages/submissions-page',
    'src/app/features/author-studio/pages/author-analytics-page',
    'src/app/features/author-studio/pages/media-library-page',

    'src/app/features/admin/components/admin-data-table',
    'src/app/features/admin/components/moderation-action-dialog',
    'src/app/features/admin/components/report-evidence-viewer',
    'src/app/features/admin/components/user-status-badge',
    'src/app/features/admin/components/permission-matrix',
    'src/app/features/admin/pages/admin-dashboard-page',
    'src/app/features/admin/pages/users/user-list-page',
    'src/app/features/admin/pages/users/user-detail-page',
    'src/app/features/admin/pages/roles/role-list-page',
    'src/app/features/admin/pages/roles/role-detail-page',
    'src/app/features/admin/pages/authors/author-verification-page',
    'src/app/features/admin/pages/taxonomy/category-list-page',
    'src/app/features/admin/pages/taxonomy/tag-list-page',
    'src/app/features/admin/pages/submissions/submission-list-page',
    'src/app/features/admin/pages/submissions/submission-detail-page',
    'src/app/features/admin/pages/reports/report-list-page',
    'src/app/features/admin/pages/reports/report-detail-page',
    'src/app/features/admin/pages/moderation/moderation-history-page',
    'src/app/features/admin/pages/moderation/comment-moderation-page',
    'src/app/features/admin/pages/media/media-management-page',
    'src/app/features/admin/pages/audit/audit-log-page',
    'src/app/features/admin/pages/analytics/analytics-dashboard-page',
    'src/app/features/admin/pages/system/system-health-page',

    'src/app/features/errors/pages/forbidden-page',
    'src/app/features/errors/pages/not-found-page',
    'src/app/features/errors/pages/server-error-page',
    'src/app/features/errors/pages/maintenance-page'
)

foreach ($directory in $directories) {
    New-DirectorySafe -Path (Join-Path $ProjectRoot $directory)
}

# -----------------------------------------------------------------------------
# Root, configuration, documentation and test files
# -----------------------------------------------------------------------------
$plainFiles = @(
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
    'docs/adr/0001-frontend-architecture.md',
    'docs/adr/0002-auth-token-strategy.md',
    'docs/adr/0003-state-management.md',
    'docs/architecture/dependency-rules.md',
    'docs/architecture/frontend-overview.md',
    'e2e/fixtures/auth.fixture.ts',
    'e2e/fixtures/story.fixture.ts',
    'e2e/pages/login.page.ts',
    'e2e/pages/story-reader.page.ts',
    'e2e/specs/auth/login.spec.ts',
    'e2e/specs/auth/session-management.spec.ts',
    'e2e/specs/public/story-discovery.spec.ts',
    'e2e/specs/reader/chapter-reader.spec.ts',
    'e2e/specs/account/profile.spec.ts',
    'e2e/specs/author-studio/story-management.spec.ts',
    'e2e/specs/admin/moderation.spec.ts',
    'e2e/utils/api-client.ts',
    'e2e/utils/auth-helper.ts',
    'scripts/generate-runtime-config.mjs',
    'scripts/validate-runtime-config.mjs',
    'Dockerfile',
    'nginx.conf',
    '.dockerignore',
    '.env.example',
    'proxy.conf.json',
    'src/environments/environment.ts',
    'src/environments/environment.development.ts',
    'src/styles/base/_reset.scss',
    'src/styles/base/_typography.scss',
    'src/styles/components/_forms.scss',
    'src/styles/components/_tables.scss',
    'src/styles/themes/_light.scss',
    'src/styles/themes/_dark.scss',
    'src/styles/tokens/_breakpoints.scss',
    'src/styles/tokens/_colors.scss',
    'src/styles/tokens/_elevation.scss',
    'src/styles/tokens/_spacing.scss',
    'src/styles/tokens/_typography.scss',
    'src/styles/utilities/_accessibility.scss',
    'src/styles/utilities/_layout.scss',
    'src/styles/_index.scss',

    'src/app/core/core.providers.ts',
    'src/app/core/auth/auth.initializer.ts',
    'src/app/core/auth/guards/auth.guard.ts',
    'src/app/core/auth/guards/guest.guard.ts',
    'src/app/core/auth/guards/permission.guard.ts',
    'src/app/core/auth/guards/role.guard.ts',
    'src/app/core/auth/services/access-token.service.ts',
    'src/app/core/auth/services/auth.facade.ts',
    'src/app/core/auth/services/permission.service.ts',
    'src/app/core/auth/state/auth-session.store.ts',
    'src/app/core/config/app-config.initializer.ts',
    'src/app/core/config/app-config.model.ts',
    'src/app/core/config/app-config.service.ts',
    'src/app/core/config/app-config.token.ts',
    'src/app/core/errors/global-error-handler.ts',
    'src/app/core/errors/error-presenter.service.ts',
    'src/app/core/http/api-client.service.ts',
    'src/app/core/http/contracts/api-error.model.ts',
    'src/app/core/http/contracts/http-request-options.model.ts',
    'src/app/core/http/interceptors/api-prefix.interceptor.ts',
    'src/app/core/http/interceptors/authorization.interceptor.ts',
    'src/app/core/http/interceptors/credentials.interceptor.ts',
    'src/app/core/http/interceptors/csrf.interceptor.ts',
    'src/app/core/http/interceptors/error.interceptor.ts',
    'src/app/core/http/interceptors/idempotency.interceptor.ts',
    'src/app/core/http/interceptors/locale.interceptor.ts',
    'src/app/core/http/interceptors/refresh-token.interceptor.ts',
    'src/app/core/http/interceptors/request-context.interceptor.ts',
    'src/app/core/i18n/locale.service.ts',
    'src/app/core/logging/logger.service.ts',
    'src/app/core/observability/error-reporter.service.ts',
    'src/app/core/observability/performance.service.ts',
    'src/app/core/routing/app-route-data.model.ts',
    'src/app/core/routing/preloading.strategy.ts',
    'src/app/core/security/csrf-token.service.ts',
    'src/app/core/security/device-identity.service.ts',
    'src/app/core/storage/browser-storage.service.ts',

    'src/app/shared/constants/app-routes.constant.ts',
    'src/app/shared/constants/regex.constant.ts',
    'src/app/shared/directives/autofocus.directive.ts',
    'src/app/shared/directives/debounce-click.directive.ts',
    'src/app/shared/directives/has-permission.directive.ts',
    'src/app/shared/forms/errors/form-error-message.ts',
    'src/app/shared/forms/validators/password.validator.ts',
    'src/app/shared/forms/validators/username.validator.ts',
    'src/app/shared/pipes/date-time.pipe.ts',
    'src/app/shared/pipes/file-size.pipe.ts',
    'src/app/shared/pipes/relative-time.pipe.ts',
    'src/app/shared/testing/builders/user.builder.ts',
    'src/app/shared/testing/mocks/api-response.mock.ts',
    'src/app/shared/testing/providers/test.providers.ts',
    'src/app/shared/types/nullable.type.ts',
    'src/app/shared/types/option.model.ts',
    'src/app/shared/types/page-query.model.ts',
    'src/app/shared/types/page-result.model.ts',
    'src/app/shared/types/uuid.type.ts',
    'src/app/shared/utils/date.util.ts',
    'src/app/shared/utils/object.util.ts',
    'src/app/shared/utils/query-params.util.ts',
    'src/app/shared/utils/string.util.ts',

    'src/app/features/auth/auth.routes.ts',
    'src/app/features/public/public.routes.ts',
    'src/app/features/reader/reader.routes.ts',
    'src/app/features/account/account.routes.ts',
    'src/app/features/author-studio/author-studio.routes.ts',
    'src/app/features/admin/admin.routes.ts',
    'src/app/features/errors/error.routes.ts'
)

foreach ($file in $plainFiles) {
    New-FileSafe -RelativePath $file -Content (Get-PlaceholderContent -RelativePath $file)
}

# -----------------------------------------------------------------------------
# Shared UI components
# -----------------------------------------------------------------------------
$sharedComponents = @(
    'app-logo',
    'avatar',
    'badge',
    'button',
    'card',
    'confirm-dialog',
    'data-table',
    'empty-state',
    'error-state',
    'file-uploader',
    'form-field',
    'image',
    'loading-overlay',
    'pagination',
    'search-box',
    'skeleton',
    'status-badge',
    'toast',
    'toolbar'
)

foreach ($component in $sharedComponents) {
    New-ComponentSkeleton -BasePath "src/app/shared/ui/$component/$component"
}

# -----------------------------------------------------------------------------
# Layout components
# -----------------------------------------------------------------------------
$layoutComponents = @(
    'src/app/layouts/public-layout/public-layout',
    'src/app/layouts/public-layout/components/public-header/public-header',
    'src/app/layouts/public-layout/components/public-footer/public-footer',
    'src/app/layouts/auth-layout/auth-layout',
    'src/app/layouts/reader-layout/reader-layout',
    'src/app/layouts/reader-layout/components/reader-toolbar/reader-toolbar',
    'src/app/layouts/account-layout/account-layout',
    'src/app/layouts/account-layout/components/account-sidebar/account-sidebar',
    'src/app/layouts/author-layout/author-layout',
    'src/app/layouts/author-layout/components/author-sidebar/author-sidebar',
    'src/app/layouts/admin-layout/admin-layout',
    'src/app/layouts/admin-layout/components/admin-sidebar/admin-sidebar',
    'src/app/layouts/admin-layout/components/admin-header/admin-header',
    'src/app/layouts/error-layout/error-layout'
)

foreach ($component in $layoutComponents) {
    New-ComponentSkeleton -BasePath $component
}

# -----------------------------------------------------------------------------
# Domain files mapped from the NestJS/Prisma backend
# -----------------------------------------------------------------------------
$domainFiles = @(
    # Auth API currently implemented by backend.
    'src/app/domains/auth/contracts/requests/login.request.ts',
    'src/app/domains/auth/contracts/requests/register.request.ts',
    'src/app/domains/auth/contracts/requests/verify-email.request.ts',
    'src/app/domains/auth/contracts/requests/resend-email-verification.request.ts',
    'src/app/domains/auth/contracts/requests/forgot-password.request.ts',
    'src/app/domains/auth/contracts/requests/reset-password.request.ts',
    'src/app/domains/auth/contracts/requests/change-password.request.ts',
    'src/app/domains/auth/contracts/requests/request-email-change.request.ts',
    'src/app/domains/auth/contracts/requests/confirm-email-change.request.ts',
    'src/app/domains/auth/contracts/responses/login.response.ts',
    'src/app/domains/auth/contracts/responses/register.response.ts',
    'src/app/domains/auth/contracts/responses/refresh-token.response.ts',
    'src/app/domains/auth/contracts/responses/current-user.response.ts',
    'src/app/domains/auth/contracts/responses/session.response.ts',
    'src/app/domains/auth/contracts/responses/security-event.response.ts',
    'src/app/domains/auth/contracts/responses/change-password.response.ts',
    'src/app/domains/auth/contracts/responses/change-email.response.ts',
    'src/app/domains/auth/data-access/auth.api.ts',
    'src/app/domains/auth/data-access/session.api.ts',
    'src/app/domains/auth/mappers/auth.mapper.ts',
    'src/app/domains/auth/models/access-token.model.ts',
    'src/app/domains/auth/models/current-user.model.ts',
    'src/app/domains/auth/models/security-event.model.ts',
    'src/app/domains/auth/models/session.model.ts',
    'src/app/domains/auth/state/auth.store.ts',

    # Users, roles and permissions.
    'src/app/domains/users/contracts/user-query.ts',
    'src/app/domains/users/contracts/update-user.request.ts',
    'src/app/domains/users/data-access/roles.api.ts',
    'src/app/domains/users/data-access/users.api.ts',
    'src/app/domains/users/mappers/user.mapper.ts',
    'src/app/domains/users/models/account-status.enum.ts',
    'src/app/domains/users/models/permission.model.ts',
    'src/app/domains/users/models/role.model.ts',
    'src/app/domains/users/models/user.model.ts',
    'src/app/domains/users/state/users.store.ts',

    # Author profiles and contributors.
    'src/app/domains/authors/contracts/author-query.ts',
    'src/app/domains/authors/contracts/update-author-profile.request.ts',
    'src/app/domains/authors/data-access/authors.api.ts',
    'src/app/domains/authors/mappers/author.mapper.ts',
    'src/app/domains/authors/models/author-profile.model.ts',
    'src/app/domains/authors/models/author-verification-status.enum.ts',
    'src/app/domains/authors/models/contributor-role.enum.ts',
    'src/app/domains/authors/models/story-contributor.model.ts',
    'src/app/domains/authors/state/authors.store.ts',

    # Media API currently implemented by backend.
    'src/app/domains/media/contracts/confirm-media-upload.request.ts',
    'src/app/domains/media/contracts/create-upload-intent.request.ts',
    'src/app/domains/media/contracts/create-upload-intent.response.ts',
    'src/app/domains/media/contracts/media.response.ts',
    'src/app/domains/media/data-access/media.api.ts',
    'src/app/domains/media/mappers/media.mapper.ts',
    'src/app/domains/media/models/media-asset.model.ts',
    'src/app/domains/media/models/media-purpose.enum.ts',
    'src/app/domains/media/models/media-resource-type.enum.ts',
    'src/app/domains/media/models/media-status.enum.ts',
    'src/app/domains/media/services/cloudinary-upload.service.ts',
    'src/app/domains/media/services/media-upload.facade.ts',
    'src/app/domains/media/state/media.store.ts',

    # Stories.
    'src/app/domains/stories/contracts/create-story.request.ts',
    'src/app/domains/stories/contracts/story-query.ts',
    'src/app/domains/stories/contracts/update-story.request.ts',
    'src/app/domains/stories/data-access/stories.api.ts',
    'src/app/domains/stories/mappers/story.mapper.ts',
    'src/app/domains/stories/models/content-rating.enum.ts',
    'src/app/domains/stories/models/story-detail.model.ts',
    'src/app/domains/stories/models/story-status.enum.ts',
    'src/app/domains/stories/models/story-summary.model.ts',
    'src/app/domains/stories/models/story-visibility.enum.ts',
    'src/app/domains/stories/models/story.model.ts',
    'src/app/domains/stories/state/stories.store.ts',
    'src/app/domains/stories/state/story-detail.store.ts',

    # Chapters and chapter versions.
    'src/app/domains/chapters/contracts/chapter-query.ts',
    'src/app/domains/chapters/contracts/create-chapter.request.ts',
    'src/app/domains/chapters/contracts/update-chapter.request.ts',
    'src/app/domains/chapters/data-access/chapters.api.ts',
    'src/app/domains/chapters/mappers/chapter.mapper.ts',
    'src/app/domains/chapters/models/chapter-media.model.ts',
    'src/app/domains/chapters/models/chapter-status.enum.ts',
    'src/app/domains/chapters/models/chapter-version.model.ts',
    'src/app/domains/chapters/models/chapter.model.ts',
    'src/app/domains/chapters/models/content-format.enum.ts',
    'src/app/domains/chapters/state/chapter-editor.store.ts',
    'src/app/domains/chapters/state/chapters.store.ts',

    # Categories and tags.
    'src/app/domains/taxonomy/contracts/category.request.ts',
    'src/app/domains/taxonomy/contracts/tag.request.ts',
    'src/app/domains/taxonomy/data-access/taxonomy.api.ts',
    'src/app/domains/taxonomy/models/category.model.ts',
    'src/app/domains/taxonomy/models/tag.model.ts',
    'src/app/domains/taxonomy/state/taxonomy.store.ts',

    # Personal library and follows.
    'src/app/domains/library/contracts/library-query.ts',
    'src/app/domains/library/contracts/update-library-entry.request.ts',
    'src/app/domains/library/data-access/library.api.ts',
    'src/app/domains/library/data-access/story-follow.api.ts',
    'src/app/domains/library/models/library-entry.model.ts',
    'src/app/domains/library/models/library-status.enum.ts',
    'src/app/domains/library/models/story-follow.model.ts',
    'src/app/domains/library/state/library.store.ts',

    # Comments, reactions and ratings.
    'src/app/domains/engagement/contracts/comment-query.ts',
    'src/app/domains/engagement/contracts/create-comment.request.ts',
    'src/app/domains/engagement/contracts/rating.request.ts',
    'src/app/domains/engagement/data-access/comments.api.ts',
    'src/app/domains/engagement/data-access/ratings.api.ts',
    'src/app/domains/engagement/models/comment-reaction.model.ts',
    'src/app/domains/engagement/models/comment.model.ts',
    'src/app/domains/engagement/models/moderation-status.enum.ts',
    'src/app/domains/engagement/models/rating.model.ts',
    'src/app/domains/engagement/models/reaction-type.enum.ts',
    'src/app/domains/engagement/state/comments.store.ts',
    'src/app/domains/engagement/state/ratings.store.ts',

    # Reading progress and sessions.
    'src/app/domains/reading/contracts/save-reading-progress.request.ts',
    'src/app/domains/reading/data-access/reading.api.ts',
    'src/app/domains/reading/models/reading-progress.model.ts',
    'src/app/domains/reading/models/reading-session.model.ts',
    'src/app/domains/reading/state/reader.store.ts',
    'src/app/domains/reading/state/reading-history.store.ts',

    # Story submission, report and moderation.
    'src/app/domains/moderation/contracts/create-report.request.ts',
    'src/app/domains/moderation/contracts/moderation-action.request.ts',
    'src/app/domains/moderation/contracts/report-query.ts',
    'src/app/domains/moderation/contracts/story-submission.request.ts',
    'src/app/domains/moderation/data-access/moderation.api.ts',
    'src/app/domains/moderation/data-access/reports.api.ts',
    'src/app/domains/moderation/data-access/submissions.api.ts',
    'src/app/domains/moderation/models/moderation-action-type.enum.ts',
    'src/app/domains/moderation/models/moderation-action.model.ts',
    'src/app/domains/moderation/models/report-reason.enum.ts',
    'src/app/domains/moderation/models/report-status.enum.ts',
    'src/app/domains/moderation/models/report-target-type.enum.ts',
    'src/app/domains/moderation/models/report.model.ts',
    'src/app/domains/moderation/models/story-submission.model.ts',
    'src/app/domains/moderation/models/submission-status.enum.ts',
    'src/app/domains/moderation/state/moderation.store.ts',
    'src/app/domains/moderation/state/reports.store.ts',
    'src/app/domains/moderation/state/submissions.store.ts',

    # Notifications.
    'src/app/domains/notifications/contracts/notification-query.ts',
    'src/app/domains/notifications/contracts/update-notification-preferences.request.ts',
    'src/app/domains/notifications/data-access/notifications.api.ts',
    'src/app/domains/notifications/models/notification-preference.model.ts',
    'src/app/domains/notifications/models/notification.model.ts',
    'src/app/domains/notifications/state/notifications.store.ts',

    # Audit logs.
    'src/app/domains/audit/contracts/audit-log-query.ts',
    'src/app/domains/audit/data-access/audit.api.ts',
    'src/app/domains/audit/models/audit-actor-type.enum.ts',
    'src/app/domains/audit/models/audit-log.model.ts',
    'src/app/domains/audit/state/audit.store.ts',

    # Aggregated story/chapter analytics.
    'src/app/domains/analytics/contracts/analytics-query.ts',
    'src/app/domains/analytics/data-access/analytics.api.ts',
    'src/app/domains/analytics/models/chapter-daily-stat.model.ts',
    'src/app/domains/analytics/models/story-daily-stat.model.ts',
    'src/app/domains/analytics/state/analytics.store.ts'
)

foreach ($file in $domainFiles) {
    New-FileSafe -RelativePath $file -Content "// TODO: implement $file`n"
}

# -----------------------------------------------------------------------------
# Routed feature components
# -----------------------------------------------------------------------------
$featureComponents = @(
    'src/app/features/auth/components/auth-card/auth-card',
    'src/app/features/auth/components/password-strength/password-strength',
    'src/app/features/auth/components/verification-notice/verification-notice',
    'src/app/features/auth/pages/login-page/login-page',
    'src/app/features/auth/pages/register-page/register-page',
    'src/app/features/auth/pages/forgot-password-page/forgot-password-page',
    'src/app/features/auth/pages/reset-password-page/reset-password-page',
    'src/app/features/auth/pages/verify-email-page/verify-email-page',
    'src/app/features/auth/pages/change-email-confirm-page/change-email-confirm-page',

    'src/app/features/public/components/story-card/story-card',
    'src/app/features/public/components/story-grid/story-grid',
    'src/app/features/public/components/story-filter/story-filter',
    'src/app/features/public/components/chapter-list/chapter-list',
    'src/app/features/public/components/author-card/author-card',
    'src/app/features/public/pages/home-page/home-page',
    'src/app/features/public/pages/discover-page/discover-page',
    'src/app/features/public/pages/search-page/search-page',
    'src/app/features/public/pages/story-detail-page/story-detail-page',
    'src/app/features/public/pages/author-detail-page/author-detail-page',
    'src/app/features/public/pages/category-detail-page/category-detail-page',
    'src/app/features/public/pages/tag-detail-page/tag-detail-page',

    'src/app/features/reader/components/chapter-content/chapter-content',
    'src/app/features/reader/components/reader-settings/reader-settings',
    'src/app/features/reader/components/chapter-navigation/chapter-navigation',
    'src/app/features/reader/components/reading-progress/reading-progress',
    'src/app/features/reader/pages/chapter-reader-page/chapter-reader-page',

    'src/app/features/account/components/profile-form/profile-form',
    'src/app/features/account/components/avatar-uploader/avatar-uploader',
    'src/app/features/account/components/session-card/session-card',
    'src/app/features/account/components/security-event-list/security-event-list',
    'src/app/features/account/components/library-filter/library-filter',
    'src/app/features/account/pages/account-overview-page/account-overview-page',
    'src/app/features/account/pages/profile-page/profile-page',
    'src/app/features/account/pages/security-page/security-page',
    'src/app/features/account/pages/sessions-page/sessions-page',
    'src/app/features/account/pages/change-password-page/change-password-page',
    'src/app/features/account/pages/change-email-page/change-email-page',
    'src/app/features/account/pages/library-page/library-page',
    'src/app/features/account/pages/reading-history-page/reading-history-page',
    'src/app/features/account/pages/notifications-page/notifications-page',
    'src/app/features/account/pages/notification-preferences-page/notification-preferences-page',

    'src/app/features/author-studio/components/story-form/story-form',
    'src/app/features/author-studio/components/story-cover-uploader/story-cover-uploader',
    'src/app/features/author-studio/components/story-status-badge/story-status-badge',
    'src/app/features/author-studio/components/contributor-table/contributor-table',
    'src/app/features/author-studio/components/chapter-form/chapter-form',
    'src/app/features/author-studio/components/chapter-editor/chapter-editor',
    'src/app/features/author-studio/components/chapter-version-list/chapter-version-list',
    'src/app/features/author-studio/components/submission-timeline/submission-timeline',
    'src/app/features/author-studio/pages/author-dashboard-page/author-dashboard-page',
    'src/app/features/author-studio/pages/story-list-page/story-list-page',
    'src/app/features/author-studio/pages/story-create-page/story-create-page',
    'src/app/features/author-studio/pages/story-edit-page/story-edit-page',
    'src/app/features/author-studio/pages/story-manage-page/story-manage-page',
    'src/app/features/author-studio/pages/contributors-page/contributors-page',
    'src/app/features/author-studio/pages/chapter-list-page/chapter-list-page',
    'src/app/features/author-studio/pages/chapter-create-page/chapter-create-page',
    'src/app/features/author-studio/pages/chapter-edit-page/chapter-edit-page',
    'src/app/features/author-studio/pages/chapter-versions-page/chapter-versions-page',
    'src/app/features/author-studio/pages/submissions-page/submissions-page',
    'src/app/features/author-studio/pages/author-analytics-page/author-analytics-page',
    'src/app/features/author-studio/pages/media-library-page/media-library-page',

    'src/app/features/admin/components/admin-data-table/admin-data-table',
    'src/app/features/admin/components/moderation-action-dialog/moderation-action-dialog',
    'src/app/features/admin/components/report-evidence-viewer/report-evidence-viewer',
    'src/app/features/admin/components/user-status-badge/user-status-badge',
    'src/app/features/admin/components/permission-matrix/permission-matrix',
    'src/app/features/admin/pages/admin-dashboard-page/admin-dashboard-page',
    'src/app/features/admin/pages/users/user-list-page/user-list-page',
    'src/app/features/admin/pages/users/user-detail-page/user-detail-page',
    'src/app/features/admin/pages/roles/role-list-page/role-list-page',
    'src/app/features/admin/pages/roles/role-detail-page/role-detail-page',
    'src/app/features/admin/pages/authors/author-verification-page/author-verification-page',
    'src/app/features/admin/pages/taxonomy/category-list-page/category-list-page',
    'src/app/features/admin/pages/taxonomy/tag-list-page/tag-list-page',
    'src/app/features/admin/pages/submissions/submission-list-page/submission-list-page',
    'src/app/features/admin/pages/submissions/submission-detail-page/submission-detail-page',
    'src/app/features/admin/pages/reports/report-list-page/report-list-page',
    'src/app/features/admin/pages/reports/report-detail-page/report-detail-page',
    'src/app/features/admin/pages/moderation/moderation-history-page/moderation-history-page',
    'src/app/features/admin/pages/moderation/comment-moderation-page/comment-moderation-page',
    'src/app/features/admin/pages/media/media-management-page/media-management-page',
    'src/app/features/admin/pages/audit/audit-log-page/audit-log-page',
    'src/app/features/admin/pages/analytics/analytics-dashboard-page/analytics-dashboard-page',
    'src/app/features/admin/pages/system/system-health-page/system-health-page',

    'src/app/features/errors/pages/forbidden-page/forbidden-page',
    'src/app/features/errors/pages/not-found-page/not-found-page',
    'src/app/features/errors/pages/server-error-page/server-error-page',
    'src/app/features/errors/pages/maintenance-page/maintenance-page'
)

foreach ($component in $featureComponents) {
    New-ComponentSkeleton -BasePath $component
}

# -----------------------------------------------------------------------------
# Seed critical contracts that exactly match the current backend.
# -----------------------------------------------------------------------------
New-FileSafe -RelativePath 'public/config/app-config.json' -Content @'
{
  "apiBaseUrl": "http://localhost:3000/api/v1",
  "defaultLocale": "vi-VN",
  "supportedLocales": ["vi-VN"],
  "production": false
}
'@

New-FileSafe -RelativePath 'src/app/core/http/contracts/api-response.model.ts' -Content @'
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly message?: string;
  readonly meta?: Record<string, unknown>;
  readonly requestId: string;
  readonly timestamp: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly retryable: boolean;
  };
  readonly requestId: string;
  readonly timestamp: string;
  readonly path: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
'@

New-FileSafe -RelativePath 'src/app/domains/auth/data-access/auth.endpoints.ts' -Content @'
export const AUTH_ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  logoutAll: '/auth/logout-all',
  revokeAccessToken: '/auth/revoke-access-token',
  verifyEmail: '/auth/verify-email',
  resendVerification: '/auth/resend-verification',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  changePassword: '/auth/change-password',
  requestEmailChange: '/auth/change-email',
  confirmEmailChange: '/auth/change-email/confirm',
  currentUser: '/auth/me',
  sessions: '/auth/sessions',
  securityEvents: '/auth/security-events',
} as const;
'@

New-FileSafe -RelativePath 'src/app/domains/users/models/role-code.enum.ts' -Content @'
export enum RoleCode {
  USER = 'USER',
  AUTHOR = 'AUTHOR',
  ADMIN = 'ADMIN',
}
'@

New-FileSafe -RelativePath 'src/app/domains/users/models/permission-code.enum.ts' -Content @'
export enum PermissionCode {
  USER_PROFILE_READ = 'user.profile.read',
  USER_PROFILE_UPDATE = 'user.profile.update',
  USER_MANAGE = 'user.manage',
  ROLE_MANAGE = 'role.manage',

  STORY_READ = 'story.read',
  STORY_CREATE = 'story.create',
  STORY_UPDATE_OWN = 'story.update.own',
  STORY_DELETE_OWN = 'story.delete.own',
  STORY_SUBMIT = 'story.submit',
  STORY_REVIEW = 'story.review',
  STORY_PUBLISH = 'story.publish',
  STORY_UPDATE_ANY = 'story.update.any',
  STORY_DELETE_ANY = 'story.delete.any',

  CHAPTER_CREATE = 'chapter.create',
  CHAPTER_UPDATE_OWN = 'chapter.update.own',
  CHAPTER_DELETE_OWN = 'chapter.delete.own',
  CHAPTER_PUBLISH_OWN = 'chapter.publish.own',
  CHAPTER_MANAGE_ANY = 'chapter.manage.any',

  COMMENT_CREATE = 'comment.create',
  COMMENT_UPDATE_OWN = 'comment.update.own',
  COMMENT_DELETE_OWN = 'comment.delete.own',
  COMMENT_MODERATE = 'comment.moderate',

  RATING_CREATE = 'rating.create',
  RATING_UPDATE_OWN = 'rating.update.own',
  LIBRARY_MANAGE_OWN = 'library.manage.own',
  FOLLOW_MANAGE_OWN = 'follow.manage.own',
  READING_HISTORY_MANAGE_OWN = 'reading-history.manage.own',

  REPORT_CREATE = 'report.create',
  REPORT_REVIEW = 'report.review',
  MODERATION_EXECUTE = 'moderation.execute',

  CATEGORY_MANAGE = 'category.manage',
  TAG_MANAGE = 'tag.manage',
  MEDIA_UPLOAD = 'media.upload',
  MEDIA_MANAGE_ANY = 'media.manage.any',
  NOTIFICATION_MANAGE_OWN = 'notification.manage.own',
  AUDIT_LOG_READ = 'audit-log.read',
  ANALYTICS_READ = 'analytics.read',
}
'@

New-FileSafe -RelativePath 'src/app/core/http/tokens/http-context.tokens.ts' -Content @'
import { HttpContextToken } from '@angular/common/http';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const SKIP_REFRESH = new HttpContextToken<boolean>(() => false);
export const USE_IDEMPOTENCY_KEY = new HttpContextToken<boolean>(() => false);
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
'@

New-FileSafe -RelativePath 'docs/api/backend-endpoints.md' -Content @'
# Backend endpoints currently available

Base path: `/api/v1`

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/revoke-access-token`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/change-email`
- `POST /auth/change-email/confirm`
- `GET /auth/me`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:sessionId`
- `GET /auth/security-events?limit=20`

## Media

- `POST /media/upload-intents`
- `POST /media/upload-intents/:mediaAssetId/confirm`
- `GET /media/:mediaAssetId`
- `DELETE /media/:mediaAssetId`

## Health

- `GET /health/live`
- `GET /health/ready`
- `GET /health/diagnostics`

The remaining domain folders are based on the Prisma schema and are ready for future controllers.
'@

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host 'Angular enterprise structure created successfully.' -ForegroundColor Green
Write-Host "Root: $ProjectRoot" -ForegroundColor Green
Write-Host 'Existing files were preserved unless -Force was supplied.' -ForegroundColor Yellow
Write-Host '============================================================' -ForegroundColor Green
