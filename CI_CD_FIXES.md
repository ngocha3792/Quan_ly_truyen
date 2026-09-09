# CI/CD Fixes - TruyenHub

## Các lỗi phổ biến và cách sửa

### 1. **Node.js và npm version mismatch**

**Vấn đề:** 
- `.nvmrc` chỉ định Node 24.15.0
- `package.json` pin npm 11.12.1
- CI workflow cố pin npm nhưng có thể conflict

**Sửa:**
```yaml
# Trong .github/workflows/ci.yml, đảm bảo pin npm đúng cách
- name: Pin npm
  run: npm install --global npm@11.12.1
```

Hoặc tốt hơn, dùng corepack:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    node-version-file: .nvmrc

- name: Enable corepack
  run: corepack enable

- name: Prepare package manager
  run: corepack prepare npm@11.12.1 --activate
```

---

### 2. **PostgreSQL service health check**

**Vấn đề:** Backend integration tests có thể fail vì PostgreSQL chưa ready

**Sửa hiện tại (đã có):**
```yaml
services:
  postgres:
    image: postgres:17-alpine
    options: >-
      --health-cmd "pg_isready -U postgres -d quan_ly_truyen_test"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 20
```

**Nếu vẫn fail, thêm explicit wait:**
```yaml
- name: Wait for PostgreSQL
  run: |
    for i in {1..30}; do
      if pg_isready -h 127.0.0.1 -U postgres -d quan_ly_truyen_test; then
        echo "PostgreSQL is ready"
        break
      fi
      echo "Waiting for PostgreSQL... ($i/30)"
      sleep 2
    done
```

---

### 3. **Redis connection issues**

**Vấn đề:** Tests có thể fail vì Redis không sẵn sàng

**Sửa - thêm wait script:**
```yaml
- name: Wait for Redis
  run: |
    for i in {1..30}; do
      if redis-cli -h 127.0.0.1 ping | grep -q PONG; then
        echo "Redis is ready"
        break
      fi
      echo "Waiting for Redis... ($i/30)"
      sleep 1
    done
```

---

### 4. **Prisma generate missing**

**Vấn đề:** Build có thể fail nếu Prisma client chưa được generate

**Sửa - thêm vào backend-quality job:**
```yaml
- name: Install dependencies
  run: npm ci --no-audit --no-fund

- name: Generate Prisma client  # ← THÊM STEP NÀY
  run: npx prisma generate

- name: Validate CI environment
  run: npm run ci:check-env
```

---

### 5. **Database migration trong CI**

**Vấn đề:** Integration tests cần DB schema được migrate

**Sửa - backend-integration job:**
```yaml
- name: Install dependencies
  run: npm ci --no-audit --no-fund

- name: Generate Prisma client
  run: npx prisma generate

- name: Run database migrations  # ← THÊM STEP NÀY
  run: |
    npm run ci:wait-db
    npm run db:migrate:deploy

- name: Validate CI environment
  run: npm run ci:check-env
```

---

### 6. **Frontend test environment**

**Vấn đề:** Karma/Jasmine tests có thể timeout hoặc fail do Chrome headless

**Sửa trong frontend/package.json:**
```json
{
  "scripts": {
    "test:ci": "ng test --no-watch --no-progress --browsers=ChromeHeadlessCI"
  }
}
```

**Và thêm karma config:**
```javascript
// frontend/karma.conf.js
module.exports = function (config) {
  config.set({
    // ...
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-extensions'
        ]
      }
    },
    browsers: process.env.CI ? ['ChromeHeadlessCI'] : ['Chrome']
  });
};
```

---

### 7. **E2E tests flakiness**

**Vấn đề:** Playwright tests có thể fail do timing issues

**Sửa - thêm retry và timeout:**
```yaml
# frontend-e2e job
- name: Run Playwright E2E
  working-directory: frontend
  run: npm run e2e:ci
  env:
    PLAYWRIGHT_TIMEOUT: 60000  # 60s timeout per test
```

**Trong playwright.config.ts:**
```typescript
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  expect: {
    timeout: 10000
  }
});
```

---

### 8. **Container build cache**

**Vấn đề:** Docker build có thể chậm hoặc hết timeout

**Sửa - thêm layer caching:**
```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build backend image with cache
  uses: docker/build-push-action@v6
  with:
    context: ./backend
    file: ./backend/Dockerfile
    tags: quan-ly-truyen-backend:ci
    push: false
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

---

### 9. **Dependency audit failures**

**Vấn đề:** npm audit có thể fail do vulnerabilities

**Option 1 - Skip audit trong CI (không khuyến khích):**
```yaml
- name: Install dependencies
  run: npm ci --no-audit --no-fund
```

**Option 2 - Allow moderate vulnerabilities:**
```yaml
- name: npm audit
  run: npm audit --audit-level=high
```

**Option 3 - Fix vulnerabilities trước:**
```bash
npm audit fix --force
```

---

### 10. **Memory issues trong tests**

**Vấn đề:** Jest/Karma có thể OOM (Out of Memory)

**Sửa - tăng memory cho Node:**
```yaml
- name: All source unit tests
  run: npm test -- --runInBand
  env:
    NODE_OPTIONS: "--max-old-space-size=4096"
```

---

## Quick Fixes - Apply ngay

### Fix 1: Update CI workflow với Prisma generate

```yaml
# Thêm vào backend-quality job sau "Install dependencies"
- name: Generate Prisma client
  run: npx prisma generate
```

### Fix 2: Update CI workflow với database wait

```yaml
# Thêm vào backend-integration job
- name: Setup database
  run: |
    npx prisma generate
    npm run ci:wait-db
    npm run db:migrate:deploy
```

### Fix 3: Update package.json scripts

```json
// backend/package.json
{
  "scripts": {
    "ci:wait-db": "node scripts/wait-for-db.js",
    "ci:check-env": "node scripts/check-ci-environment.mjs"
  }
}
```

### Fix 4: Create wait-for-db script

```javascript
// backend/scripts/wait-for-db.js
const { execSync } = require('child_process');

const maxAttempts = 30;
const delay = 2000;

for (let i = 1; i <= maxAttempts; i++) {
  try {
    execSync('npx prisma db execute --stdin <<< "SELECT 1"', {
      stdio: 'ignore',
      timeout: 5000
    });
    console.log('✓ Database is ready');
    process.exit(0);
  } catch (error) {
    if (i === maxAttempts) {
      console.error('✗ Database failed to become ready');
      process.exit(1);
    }
    console.log(`Waiting for database... (${i}/${maxAttempts})`);
    execSync(`node -e "setTimeout(() => {}, ${delay})"`);
  }
}
```

---

## Debugging CI failures

### 1. Check logs
```bash
# Local
npm run ci

# Specific job
npm run quality:check  # backend
npm run ci             # frontend
```

### 2. Reproduce CI environment locally
```bash
# Backend
cd backend
export NODE_ENV=test
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test?schema=public"
docker compose -f docker/compose.test.yml up -d
npm ci
npx prisma generate
npm run db:migrate:deploy
npm run quality:check
npm run ci:integration

# Frontend
cd frontend
npm ci
npm run quality:check
npm run test:ci
npm run build:ci
```

### 3. Check common issues
- [ ] `node_modules` committed? (should be in .gitignore)
- [ ] `.env` files committed? (should be in .gitignore)
- [ ] Database migrations valid? (`npm run db:validate`)
- [ ] TypeScript strict? (`npm run typecheck`)
- [ ] Linting pass? (`npm run lint:check`)
- [ ] Tests pass locally? (`npm test`)

---

## Full fixed workflow snippet

Thay thế backend-quality job với:

```yaml
backend-quality:
  name: Backend / quality, unit coverage and build
  runs-on: ubuntu-latest
  timeout-minutes: 30
  defaults:
    run:
      working-directory: backend
  env:
    NODE_ENV: test
    DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/quan_ly_truyen_test?schema=public
    # ... các env khác giữ nguyên

  services:
    postgres:
      image: postgres:17-alpine
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: quan_ly_truyen_test
      ports: ["5432:5432"]
      options: >-
        --health-cmd "pg_isready -U postgres -d quan_ly_truyen_test"
        --health-interval 5s
        --health-timeout 5s
        --health-retries 20
    
    redis:
      image: redis:7-alpine
      ports: ["6379:6379"]
      options: >-
        --health-cmd "redis-cli ping"
        --health-interval 5s
        --health-timeout 3s
        --health-retries 20

  steps:
    - name: Checkout
      uses: actions/checkout@v6

    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version-file: .nvmrc
        cache: npm
        cache-dependency-path: backend/package-lock.json

    - name: Enable corepack
      run: corepack enable

    - name: Install dependencies
      run: npm ci --no-audit --no-fund

    - name: Generate Prisma client
      run: npx prisma generate

    - name: Wait for services
      run: |
        echo "Waiting for PostgreSQL..."
        for i in {1..30}; do
          if npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; then
            echo "✓ PostgreSQL ready"
            break
          fi
          sleep 2
        done
        
        echo "Waiting for Redis..."
        for i in {1..30}; do
          if redis-cli -h 127.0.0.1 ping 2>/dev/null | grep -q PONG; then
            echo "✓ Redis ready"
            break
          fi
          sleep 1
        done

    - name: Validate CI environment
      run: npm run ci:check-env

    - name: Format, lint and typecheck
      run: npm run format:check && npm run lint:check && npm run typecheck:scripts

    - name: Architecture boundary guardrails
      run: npm run architecture:check

    - name: Validate Prisma schema and migration layout
      run: npm run db:validate

    - name: Build application and worker
      run: npm run build
      env:
        NODE_OPTIONS: "--max-old-space-size=4096"

    - name: Verify runtime artifacts
      run: |
        test -s dist/main.js
        test -s dist/worker.js
        test -s dist/healthcheck/worker-heartbeat.healthcheck.js
        test -s dist/healthcheck/recovery-metrics.js

    - name: Critical module unit coverage gates
      run: npm run test:critical:unit:cov
      env:
        NODE_OPTIONS: "--max-old-space-size=4096"

    - name: All source unit tests
      run: npm test -- --runInBand
      env:
        NODE_OPTIONS: "--max-old-space-size=4096"

    - name: Upload backend coverage
      if: always()
      uses: actions/upload-artifact@v7
      with:
        name: backend-coverage-${{ github.sha }}
        path: backend/coverage
        if-no-files-found: ignore
        retention-days: 7
```

---

## Nếu vẫn fail, check:

1. **GitHub Actions logs** - Xem chính xác step nào fail
2. **Secrets** - Đảm bảo không có secrets bị leak
3. **Permissions** - Workflow có đủ permissions
4. **Timeout** - Có job nào timeout không (tăng `timeout-minutes`)
5. **Flaky tests** - Có tests nào random fail không (thêm retries)

## Contact nếu cần support:
- Tạo issue với full logs
- Tag `ci/cd` label
