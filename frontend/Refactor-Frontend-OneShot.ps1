[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$ProjectRoot = (Get-Location).Path,

    [switch]$KeepLegacy,
    [switch]$SkipInstall,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Resolve-FrontendRoot {
    param([string]$InputPath)

    $resolved = (Resolve-Path -LiteralPath $InputPath).Path
    if (Test-Path -LiteralPath (Join-Path $resolved 'angular.json')) {
        return $resolved
    }

    $nested = Join-Path $resolved 'frontend'
    if (Test-Path -LiteralPath (Join-Path $nested 'angular.json')) {
        return (Resolve-Path -LiteralPath $nested).Path
    }

    throw "Không tìm thấy angular.json tại '$resolved' hoặc '$nested'."
}

function Copy-FrontendBackup {
    param(
        [string]$Source,
        [string]$Destination
    )

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $excluded = @('node_modules', 'dist', '.angular', 'out-tsc', 'coverage')

    Get-ChildItem -LiteralPath $Source -Force | Where-Object {
        $excluded -notcontains $_.Name
    } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
}

function Move-WithRelativePath {
    param(
        [string]$FilePath,
        [string]$BasePath,
        [string]$ArchivePath
    )

    $relative = $FilePath.Substring($BasePath.Length).TrimStart([char]'\', [char]'/')
    $target = Join-Path $ArchivePath $relative
    $targetDirectory = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    Move-Item -LiteralPath $FilePath -Destination $target -Force
}

$frontendRoot = Resolve-FrontendRoot -InputPath $ProjectRoot
$repoRoot = Split-Path -Parent $frontendRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$markerPath = Join-Path $frontendRoot '.frontend-refactored'

if (Test-Path -LiteralPath $markerPath) {
    throw "Frontend này đã có marker .frontend-refactored. Không chạy lại script trên cùng một cây source."
}

$nodeCommand = Get-Command node -ErrorAction Stop
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue

$backupRoot = Join-Path $repoRoot ".frontend-refactor-backup\$stamp"
$backupFrontend = Join-Path $backupRoot 'frontend'
$archiveRoot = Join-Path $repoRoot ".frontend-refactor-archive\$stamp"
$logRoot = Join-Path $repoRoot ".frontend-refactor-logs\$stamp"

Write-Step "Sao lưu frontend vào $backupFrontend"
Copy-FrontendBackup -Source $frontendRoot -Destination $backupFrontend
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$codemodPath = Join-Path ([System.IO.Path]::GetTempPath()) "qlt-frontend-refactor-$stamp.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$codemod = @'
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const appRoot = path.join(root, 'src', 'app');

function fail(message) {
  throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
}

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r?\n/g, '\n').trimEnd() + '\n', 'utf8');
}

function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  fail(`Không tìm thấy dấu đóng ${closeChar} cho vị trí ${openIndex}`);
}

function splitTopLevelObjects(arrayBody) {
  const objects = [];
  let i = 0;
  while (i < arrayBody.length) {
    const open = arrayBody.indexOf('{', i);
    if (open < 0) break;
    const close = findMatching(arrayBody, open, '{', '}');
    objects.push(arrayBody.slice(open, close + 1).trim());
    i = close + 1;
  }
  return objects;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function routePath(routeObject) {
  return routeObject.match(/\bpath\s*:\s*'([^']*)'/)?.[1] ?? null;
}

function routeTarget(routeObject) {
  return routeObject.match(/import\(\s*'([^']+)'\s*\)/s)?.[1] ?? '';
}

function formatRouteObject(routeObject, featureName) {
  let result = routeObject;
  const prefix = `./features/${featureName}/`;
  result = result.replaceAll(`'${prefix}`, `'./`);
  result = result.replace(/\n\s{6}import\(/g, '\n      import(');
  return result;
}

function refactorRoutes() {
  const rel = 'src/app/app.routes.ts';
  const source = read(rel);
  const arrayStart = source.indexOf('export const APP_ROUTES');
  if (arrayStart < 0) fail('Không tìm thấy APP_ROUTES');
  const bracketOpen = source.indexOf('[', arrayStart);
  const bracketClose = findMatching(source, bracketOpen, '[', ']');
  const objects = splitTopLevelObjects(source.slice(bracketOpen + 1, bracketClose));
  const deduped = uniqueBy(objects.filter((item) => routePath(item) !== null), routePath);
  const wildcard = deduped.find((item) => routePath(item) === '**') ?? "{ path: '**', redirectTo: '404' }";
  const groups = [
    ['public-site', 'PUBLIC_SITE_ROUTES'],
    ['auth', 'AUTH_ROUTES'],
    ['account-center', 'ACCOUNT_CENTER_ROUTES'],
    ['author-suite', 'AUTHOR_SUITE_ROUTES'],
    ['admin-center', 'ADMIN_CENTER_ROUTES'],
  ];

  for (const [feature, exportName] of groups) {
    const selected = deduped.filter((item) => routeTarget(item).includes(`/features/${feature}/`));
    if (!selected.length) fail(`Không tìm thấy route cho ${feature}`);
    const body = selected.map((item) => `  ${formatRouteObject(item, feature).replace(/\n/g, '\n  ')},`).join('\n');
    write(`src/app/features/${feature}/${feature}.routes.ts`, `import { Routes } from '@angular/router';\n\nexport const ${exportName}: Routes = [\n${body}\n];`);
  }

  const imports = groups.map(([feature, exportName]) => `import { ${exportName} } from './features/${feature}/${feature}.routes';`).join('\n');
  const spreads = groups.map(([, exportName]) => `  ...${exportName},`).join('\n');
  write(rel, `import { Routes } from '@angular/router';\n${imports}\n\nexport const APP_ROUTES: Routes = [\n${spreads}\n  ${wildcard},\n];\n\nexport const routes = APP_ROUTES;`);
  return { before: objects.length, after: deduped.length, groups: groups.length };
}

function pascal(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function findSwitch(html) {
  const match = /@switch\s*\(\s*page\(\)\s*\)\s*\{/.exec(html);
  if (!match) fail('Không tìm thấy @switch(page()) trong template');
  const open = html.indexOf('{', match.index);
  const close = findMatching(html, open, '{', '}');
  return { start: match.index, open, close, body: html.slice(open + 1, close) };
}

function parseCases(body) {
  const cases = [];
  const re = /@case\s*\(\s*'([^']+)'\s*\)\s*\{/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    const open = body.indexOf('{', match.index);
    const close = findMatching(body, open, '{', '}');
    cases.push({ key: match[1], content: body.slice(open + 1, close).trim() });
    re.lastIndex = close + 1;
  }
  const defaultMatch = /@default\s*\{/g.exec(body);
  if (defaultMatch) {
    const open = body.indexOf('{', defaultMatch.index);
    const close = findMatching(body, open, '{', '}');
    cases.push({ key: 'default', content: body.slice(open + 1, close).trim(), isDefault: true });
  }
  if (!cases.length) fail('Không tách được @case nào');
  return cases;
}

function extractDecoratorImports(ts) {
  const marker = ts.indexOf('@Component');
  const importsIndex = ts.indexOf('imports:', marker);
  if (importsIndex < 0) return '';
  const open = ts.indexOf('[', importsIndex);
  const close = findMatching(ts, open, '[', ']');
  return ts.slice(open + 1, close).trim();
}

function stripComponentDecorator(ts, className, baseName) {
  const decoratorStart = ts.indexOf('@Component');
  if (decoratorStart < 0) fail(`Không tìm thấy @Component của ${className}`);
  const parenOpen = ts.indexOf('(', decoratorStart);
  const parenClose = findMatching(ts, parenOpen, '(', ')');
  let after = parenClose + 1;
  while (after < ts.length && /[\s;]/.test(ts[after])) after += 1;
  const noDecorator = ts.slice(0, decoratorStart) + ts.slice(after);
  return noDecorator.replace(`export class ${className}`, `export abstract class ${baseName}`);
}

function replaceClassWithBase(ts, className, baseName) {
  const classIndex = ts.indexOf(`export class ${className}`);
  if (classIndex < 0) fail(`Không tìm thấy class ${className}`);
  const open = ts.indexOf('{', classIndex);
  const close = findMatching(ts, open, '{', '}');
  return ts.slice(0, classIndex) + `export class ${className} extends ${baseName} {}` + ts.slice(close + 1);
}

function addCoreImport(ts, symbol) {
  const re = /import\s*\{([\s\S]*?)\}\s*from\s*'@angular\/core';/;
  const match = re.exec(ts);
  if (!match) fail('Không tìm thấy import @angular/core');
  if (new RegExp(`\\b${symbol}\\b`).test(match[1])) return ts;
  const content = match[1].trim();
  const separator = content.includes('\n') ? '\n  ' : ' ';
  const next = content.includes('\n')
    ? `\n  ${content.replace(/^\s+|\s+$/g, '')}${content.trimEnd().endsWith(',') ? '' : ','}\n  ${symbol},\n`
    : ` ${content.trim().replace(/,?$/, ',')} ${symbol} `;
  return ts.slice(0, match.index) + `import {${next}} from '@angular/core';` + ts.slice(match.index + match[0].length);
}

function addImportsToDecorator(ts, classNames) {
  const marker = ts.indexOf('@Component');
  const importsIndex = ts.indexOf('imports:', marker);
  if (importsIndex < 0) fail('Không tìm thấy imports trong decorator');
  const open = ts.indexOf('[', importsIndex);
  const close = findMatching(ts, open, '[', ']');
  const existing = ts.slice(open + 1, close).trim();
  const all = [existing, ...classNames].filter(Boolean).join(', ');
  return ts.slice(0, open + 1) + all + ts.slice(close);
}

function addEncapsulation(ts) {
  if (/\bencapsulation\s*:/.test(ts)) return ts;
  const change = ts.indexOf('changeDetection:');
  if (change < 0) fail('Không tìm thấy changeDetection');
  const lineStart = ts.lastIndexOf('\n', change) + 1;
  const indent = ts.slice(lineStart, change).match(/^\s*/)?.[0] ?? '  ';
  return ts.slice(0, lineStart) + `${indent}encapsulation: ViewEncapsulation.None,\n` + ts.slice(lineStart);
}

function stripParentDeclarations(ts) {
  const decoratorStart = ts.indexOf('@Component');
  if (decoratorStart < 0) fail('Không tìm thấy @Component');
  const importMatches = [...ts.slice(0, decoratorStart).matchAll(/^import[\s\S]*?;\s*$/gm)];
  if (!importMatches.length) return ts;
  const last = importMatches[importMatches.length - 1];
  const keepUntil = last.index + last[0].length;
  return ts.slice(0, keepUntil).trimEnd() + '\n\n' + ts.slice(decoratorStart);
}

function addLocalImports(ts, lines) {
  const importMatches = [...ts.matchAll(/^import[\s\S]*?;\s*$/gm)];
  if (!importMatches.length) fail('Không tìm thấy import để chèn');
  const last = importMatches[importMatches.length - 1];
  const insertAt = last.index + last[0].length;
  return ts.slice(0, insertAt) + '\n' + lines.join('\n') + ts.slice(insertAt);
}

function scopeSelectors(selectorText, rootSelector) {
  return selectorText.split(',').map((raw) => {
    const selector = raw.trim();
    if (!selector) return selector;
    if (selector.startsWith(':host')) return selector.replace(/^:host/, rootSelector);
    if (selector.startsWith(rootSelector)) return selector;
    if (/^(from|to|\d+(?:\.\d+)?%)$/.test(selector)) return selector;
    return `${rootSelector} ${selector}`;
  }).join(',');
}

function scopeCss(css, rootSelector) {
  css = css.replace(new RegExp(rootSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*', 'g'), `${rootSelector} *`);
  function processRange(start, end, inKeyframes = false) {
    let out = '';
    let cursor = start;
    let tokenStart = start;
    let quote = null;
    let escaped = false;
    let comment = false;
    while (cursor < end) {
      const ch = css[cursor];
      const next = css[cursor + 1];
      if (comment) {
        if (ch === '*' && next === '/') { comment = false; cursor += 2; continue; }
        cursor += 1; continue;
      }
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = null;
        cursor += 1; continue;
      }
      if (ch === '/' && next === '*') { comment = true; cursor += 2; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cursor += 1; continue; }
      if (ch === ';') {
        out += css.slice(tokenStart, cursor + 1);
        tokenStart = cursor + 1;
        cursor += 1;
        continue;
      }
      if (ch === '{') {
        const headerRaw = css.slice(tokenStart, cursor);
        const header = headerRaw.trim();
        const close = findMatching(css, cursor, '{', '}');
        const leading = headerRaw.slice(0, headerRaw.length - headerRaw.trimStart().length);
        const lower = header.toLowerCase();
        if (lower.startsWith('@media') || lower.startsWith('@supports') || lower.startsWith('@container') || lower.startsWith('@layer')) {
          out += `${leading}${header}{${processRange(cursor + 1, close, false)}}`;
        } else if (lower.startsWith('@keyframes') || lower.startsWith('@-webkit-keyframes')) {
          out += `${leading}${header}{${css.slice(cursor + 1, close)}}`;
        } else if (lower.startsWith('@font-face') || lower.startsWith('@property') || inKeyframes) {
          out += `${leading}${header}{${css.slice(cursor + 1, close)}}`;
        } else {
          out += `${leading}${scopeSelectors(header, rootSelector)}{${css.slice(cursor + 1, close)}}`;
        }
        cursor = close + 1;
        tokenStart = cursor;
        continue;
      }
      cursor += 1;
    }
    out += css.slice(tokenStart, end);
    return out;
  }
  return processRange(0, css.length);
}

function splitPage(config) {
  const dir = `src/app/features/${config.feature}/pages/${config.page}`;
  const stem = `${config.page}.component`;
  const htmlRel = `${dir}/${stem}.html`;
  const tsRel = `${dir}/${stem}.ts`;
  const scssRel = `${dir}/${stem}.scss`;
  const html = read(htmlRel);
  const ts = read(tsRel);
  const scss = read(scssRel);
  if (ts.includes(`${config.page}.base`)) {
    return { feature: config.feature, skipped: true, cases: 0 };
  }

  const sw = findSwitch(html);
  const cases = parseCases(sw.body);
  const baseName = `${config.classPrefix}PageBase`;
  const className = `${config.classPrefix}PageComponent`;
  const decoratorImports = extractDecoratorImports(ts);
  const nonCoreImports = [...ts.matchAll(/^import[\s\S]*?from\s*'([^']+)';\s*$/gm)]
    .filter((match) => match[1] !== '@angular/core')
    .map((match) => match[0].trim());

  const childMeta = cases.map((item) => {
    const suffix = pascal(item.key);
    return {
      ...item,
      className: `${config.classPrefix}${suffix}ViewComponent`,
      selector: `app-${config.selectorPrefix}-${item.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-view`,
      fileStem: `${config.page}.${item.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-view.component`,
    };
  });

  write(`${dir}/${config.page}.base.ts`, stripComponentDecorator(ts, className, baseName));

  for (const child of childMeta) {
    write(`${dir}/${child.fileStem}.html`, child.content);
    const childImports = nonCoreImports.length ? `${nonCoreImports.join('\n')}\n` : '';
    write(`${dir}/${child.fileStem}.ts`, `import { ChangeDetectionStrategy, Component } from '@angular/core';\n${childImports}import { ${baseName} } from './${config.page}.base';\n\n@Component({\n  selector: '${child.selector}',\n  standalone: true,\n  imports: [${decoratorImports}],\n  templateUrl: './${child.fileStem}.html',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class ${child.className} extends ${baseName} {}`);
  }

  const replacement = [
    '@switch (page()) {',
    ...childMeta.map((child) => child.isDefault
      ? `  @default { <${child.selector}></${child.selector}> }`
      : `  @case ('${child.key}') { <${child.selector}></${child.selector}> }`),
    '}',
  ].join('\n');
  write(htmlRel, html.slice(0, sw.start) + replacement + html.slice(sw.close + 1));

  let parentTs = ts;
  parentTs = addCoreImport(parentTs, 'ViewEncapsulation');
  const localImports = [
    `import { ${baseName} } from './${config.page}.base';`,
    ...childMeta.map((child) => `import { ${child.className} } from './${child.fileStem}';`),
  ];
  parentTs = addLocalImports(parentTs, localImports);
  parentTs = stripParentDeclarations(parentTs);
  parentTs = addImportsToDecorator(parentTs, childMeta.map((child) => child.className));
  parentTs = addEncapsulation(parentTs);
  parentTs = replaceClassWithBase(parentTs, className, baseName);
  write(tsRel, parentTs);
  write(scssRel, scopeCss(scss, config.rootSelector));

  return { feature: config.feature, skipped: false, cases: childMeta.length };
}

function writeDesignSystem() {
  write('src/styles.scss', `@use 'styles/index';`);
  write('src/styles/_index.scss', `@use 'tokens/colors';\n@use 'tokens/spacing';\n@use 'tokens/typography';\n@use 'tokens/elevation';\n@use 'base/reset';\n@use 'base/typography';\n@use 'components/forms';\n@use 'components/tables';\n@use 'utilities/accessibility';\n@use 'utilities/layout';\n@use 'themes/light';\n@use 'themes/dark';`);
  write('src/styles/tokens/_colors.scss', `:root {\n  --color-bg: #0b1220;\n  --color-surface: #111b2b;\n  --color-surface-raised: #172235;\n  --color-border: #2a3850;\n  --color-text: #eef3fa;\n  --color-text-muted: #94a3b8;\n  --color-primary: #7652e8;\n  --color-primary-hover: #6844dc;\n  --color-success: #31c67a;\n  --color-warning: #f0b43c;\n  --color-danger: #ef5b68;\n}`);
  write('src/styles/tokens/_spacing.scss', `:root {\n  --space-1: 0.25rem;\n  --space-2: 0.5rem;\n  --space-3: 0.75rem;\n  --space-4: 1rem;\n  --space-5: 1.25rem;\n  --space-6: 1.5rem;\n  --space-8: 2rem;\n  --radius-sm: 0.375rem;\n  --radius-md: 0.625rem;\n  --radius-lg: 0.875rem;\n}`);
  write('src/styles/tokens/_typography.scss', `:root {\n  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;\n  --text-xs: 0.75rem;\n  --text-sm: 0.875rem;\n  --text-md: 1rem;\n  --text-lg: 1.125rem;\n  --text-xl: 1.5rem;\n}`);
  write('src/styles/tokens/_elevation.scss', `:root {\n  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.18);\n  --shadow-md: 0 10px 30px rgb(0 0 0 / 0.2);\n  --focus-ring: 0 0 0 3px rgb(118 82 232 / 0.28);\n}`);
  write('src/styles/tokens/_breakpoints.scss', `$breakpoint-sm: 36rem;\n$breakpoint-md: 48rem;\n$breakpoint-lg: 64rem;\n$breakpoint-xl: 80rem;`);
  write('src/styles/base/_reset.scss', `*, *::before, *::after { box-sizing: border-box; }\nhtml { min-width: 20rem; min-height: 100%; }\nbody { min-height: 100vh; margin: 0; background: var(--color-bg); color: var(--color-text); }\nbutton, input, select, textarea { font: inherit; }\nbutton, [role='button'] { cursor: pointer; }\nimg, svg { display: block; max-width: 100%; }\na { color: inherit; }`);
  write('src/styles/base/_typography.scss', `body { font-family: var(--font-sans); line-height: 1.5; text-rendering: optimizeLegibility; }\nh1, h2, h3, p { overflow-wrap: anywhere; }`);
  write('src/styles/components/_forms.scss', `:where(input, select, textarea) { color: inherit; }\n:where(input, select, textarea, button):focus-visible { outline: none; box-shadow: var(--focus-ring); }`);
  write('src/styles/components/_tables.scss', `table { border-collapse: collapse; }\nth { text-align: left; }`);
  write('src/styles/utilities/_accessibility.scss', `.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }`);
  write('src/styles/utilities/_layout.scss', `.container { width: min(100% - 2rem, 75rem); margin-inline: auto; }\n.stack { display: grid; gap: var(--space-4); }\n.cluster { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }`);
  write('src/styles/themes/_light.scss', `[data-theme='light'] { color-scheme: light; --color-bg: #f5f7fb; --color-surface: #ffffff; --color-surface-raised: #ffffff; --color-border: #dce3ee; --color-text: #162033; --color-text-muted: #64748b; }`);
  write('src/styles/themes/_dark.scss', `:root, [data-theme='dark'] { color-scheme: dark; }`);
}

function writeBarrels() {
  const featureNames = ['public-site', 'auth', 'account-center', 'author-suite', 'admin-center'];
  for (const feature of featureNames) {
    const dir = path.join(appRoot, 'features', feature);
    const routeFile = `${feature}.routes`;
    write(`src/app/features/${feature}/index.ts`, `export * from './${routeFile}';`);
  }
  write('src/app/shared/ui/index.ts', `export * from './account-center-icon/account-center-icon.component';\nexport * from './admin-center-icon/admin-center-icon.component';\nexport * from './auth-icon/auth-icon.component';\nexport * from './public-site-icon/public-site-icon.component';`);
}

function updateTooling() {
  const packageJson = JSON.parse(read('package.json'));
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.format = 'prettier --write \"src/**/*.{ts,html,scss}\" \"*.{json,md}\"';
  packageJson.scripts['format:check'] = 'prettier --check \"src/**/*.{ts,html,scss}\" \"*.{json,md}\"';
  write('package.json', JSON.stringify(packageJson, null, 2));
  write('.prettierignore', `dist/\nnode_modules/\n.angular/\n.refactor-backup/\n.refactor-archive/`);
}

function writeArchitectureDoc(results, routeStats) {
  const lines = results.map((item) => `- ${item.feature}: ${item.skipped ? 'đã tách trước đó' : `${item.cases} view component`}`).join('\n');
  write('FRONTEND_ARCHITECTURE.md', `# Frontend architecture\n\n## Quy ước\n\n- Mỗi khu vực nghiệp vụ có file route riêng tại \`src/app/features/<feature>/<feature>.routes.ts\`.\n- Routed page chỉ giữ shell (header/sidebar); từng trạng thái route nằm trong view component riêng.\n- Logic và mock data dùng chung của các view nằm trong \`*.base.ts\`. Khi nối API thật, chuyển data access sang facade/service theo feature.\n- CSS của page được scope bằng root class của feature để tránh selector như \`.panel\`, \`.sidebar\`, \`.tabs\` đè nhau.\n- Global style chỉ chứa token, reset, typography, utility và theme.\n- Các feature cũ không còn route được chuyển ra khỏi \`src/app/features\` bởi PowerShell wrapper và vẫn nằm trong bản backup.\n\n## Kết quả refactor\n\n${lines}\n\n- Route objects trước khi dọn: ${routeStats.before}\n- Route paths sau khi loại trùng: ${routeStats.after}\n- Route modules: ${routeStats.groups}\n\n## Cấu trúc chuẩn\n\n\`\`\`text\nsrc/app/\n├── app.routes.ts\n├── features/\n│   └── <feature>/\n│       ├── <feature>.routes.ts\n│       └── pages/\n│           └── <page>/\n│               ├── <page>.component.ts       # shell\n│               ├── <page>.component.html     # shell\n│               ├── <page>.component.scss    # style đã scope\n│               ├── <page>.base.ts            # state/data dùng chung\n│               └── <page>.*-view.component.* # view theo route\n├── shared/\n│   └── ui/\n└── styles/\n    ├── tokens/\n    ├── base/\n    ├── components/\n    ├── utilities/\n    └── themes/\n\`\`\`\n`);
}

function main() {
  if (!fs.existsSync(path.join(root, 'angular.json'))) fail(`Không phải Angular workspace: ${root}`);
  const routeStats = refactorRoutes();
  const targets = [
    { feature: 'admin-center', page: 'admin-center-page', classPrefix: 'AdminCenter', selectorPrefix: 'admin-center', rootSelector: '.admin-center' },
    { feature: 'account-center', page: 'account-center-page', classPrefix: 'AccountCenter', selectorPrefix: 'account-center', rootSelector: '.account-center' },
    { feature: 'author-suite', page: 'author-suite-page', classPrefix: 'AuthorSuite', selectorPrefix: 'author-suite', rootSelector: '.suite' },
    { feature: 'public-site', page: 'public-site-page', classPrefix: 'PublicSite', selectorPrefix: 'public-site', rootSelector: '.public-site' },
  ];
  const results = targets.map(splitPage);
  writeDesignSystem();
  writeBarrels();
  updateTooling();
  writeArchitectureDoc(results, routeStats);
  console.log(JSON.stringify({ routeStats, results }, null, 2));
}

main();

'@
[System.IO.File]::WriteAllText($codemodPath, $codemod, $utf8NoBom)

try {
    Write-Step 'Tách route, page view, base state và chuẩn hóa style'
    & $nodeCommand.Source $codemodPath $frontendRoot 2>&1 | Tee-Object -FilePath (Join-Path $logRoot 'codemod.log')
    if ($LASTEXITCODE -ne 0) {
        throw "Codemod thất bại. Source gốc đã được sao lưu tại $backupFrontend"
    }
}
finally {
    Remove-Item -LiteralPath $codemodPath -Force -ErrorAction SilentlyContinue
}

if (-not $KeepLegacy) {
    Write-Step 'Chuyển feature cũ bị route mới thay thế ra khỏi src/app/features'
    $legacyFeatures = @(
        'account',
        'admin',
        'author',
        'author-studio',
        'dashboard',
        'errors',
        'home',
        'public',
        'reader',
        'reading',
        'stories'
    )

    $legacyFeatureArchive = Join-Path $archiveRoot 'legacy-features'
    New-Item -ItemType Directory -Path $legacyFeatureArchive -Force | Out-Null

    foreach ($featureName in $legacyFeatures) {
        $featurePath = Join-Path $frontendRoot "src\app\features\$featureName"
        if (Test-Path -LiteralPath $featurePath) {
            Move-Item -LiteralPath $featurePath -Destination (Join-Path $legacyFeatureArchive $featureName) -Force
        }
    }
}

Write-Step 'Cất các file backup/generator cũ khỏi workspace'
$miscArchive = Join-Path $archiveRoot 'old-generated-files'
New-Item -ItemType Directory -Path $miscArchive -Force | Out-Null

$oldFiles = Get-ChildItem -LiteralPath $frontendRoot -Recurse -Force -File | Where-Object {
    $_.Name -match '\.bak($|-)' -or
    $_.Name -match '\.backup($|-)' -or
    $_.Name -match '\.before-' -or
    $_.Name -eq 'New-QuanLyTruyenAngularStructure.ps1'
}

foreach ($oldFile in $oldFiles) {
    Move-WithRelativePath -FilePath $oldFile.FullName -BasePath $frontendRoot -ArchivePath $miscArchive
}

$installOk = $true
$nodeModules = Join-Path $frontendRoot 'node_modules'
Push-Location $frontendRoot
try {
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath $nodeModules)) {
        if ($null -eq $npmCommand) {
            Write-Warning 'Không tìm thấy npm; bỏ qua cài dependency và build.'
            $installOk = $false
        }
        else {
            Write-Step 'Cài dependency bằng npm ci'
            & $npmCommand.Source ci --no-audit --no-fund 2>&1 | Tee-Object -FilePath (Join-Path $logRoot 'npm-ci.log')
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "npm ci thất bại. Xem log: $(Join-Path $logRoot 'npm-ci.log')"
                $installOk = $false
            }
        }
    }

    if ($installOk -and (Test-Path -LiteralPath $nodeModules) -and $null -ne $npmCommand) {
        Write-Step 'Format source bằng Prettier'
        & $npmCommand.Source run format 2>&1 | Tee-Object -FilePath (Join-Path $logRoot 'format.log')
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Prettier thất bại. Xem log: $(Join-Path $logRoot 'format.log')"
        }

        if (-not $SkipBuild) {
            Write-Step 'Build Angular production'
            & $npmCommand.Source run build 2>&1 | Tee-Object -FilePath (Join-Path $logRoot 'build.log')
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Build thất bại. Source đã được refactor; xem log: $(Join-Path $logRoot 'build.log')"
            }
            else {
                Write-Host 'Build thành công.' -ForegroundColor Green
            }
        }
    }
}
finally {
    Pop-Location
}

$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($null -ne $gitCommand -and (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) {
    Write-Step 'Kiểm tra whitespace bằng git diff --check'
    Push-Location $repoRoot
    try {
        & $gitCommand.Source diff --check 2>&1 | Tee-Object -FilePath (Join-Path $logRoot 'git-diff-check.log')
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "git diff --check phát hiện lỗi. Xem log trong $logRoot"
        }
    }
    finally {
        Pop-Location
    }
}

$markerContent = @"
RefactoredAt=$((Get-Date).ToString('o'))
Backup=$backupFrontend
Archive=$archiveRoot
Logs=$logRoot
KeepLegacy=$KeepLegacy
"@
[System.IO.File]::WriteAllText($markerPath, $markerContent, $utf8NoBom)

Write-Host "`nHoàn tất refactor frontend." -ForegroundColor Green
Write-Host "- Backup:  $backupFrontend"
Write-Host "- Archive: $archiveRoot"
Write-Host "- Logs:    $logRoot"
Write-Host "- Tài liệu: $(Join-Path $frontendRoot 'FRONTEND_ARCHITECTURE.md')"
