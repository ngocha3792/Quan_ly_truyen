import path from 'node:path';

const forbiddenLayerDependencies = {
  domain: new Set(['data-access', 'pages', 'ui']),
  'data-access': new Set(['pages', 'ui']),
  ui: new Set(['data-access', 'pages']),
};

const featureLayers = new Set(['domain', 'data-access', 'pages', 'ui']);

/**
 * Resolve import mà không cần đọc filesystem.
 *
 * Ví dụ:
 * ./abc
 * @core/auth/auth.store
 * @features/account/...
 */
export function resolveImportTarget(sourceFile, specifier, pathAliases = []) {
  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(sourceFile), specifier);
  }

  for (const alias of pathAliases) {
    const resolved = resolveAlias(specifier, alias);

    if (resolved) {
      return resolved;
    }
  }

  return null;
}

/**
 * Kiểm tra:
 *
 * 1. dependency direction giữa các layer
 * 2. domain không được phụ thuộc Angular
 * 3. feature này không được chọc trực tiếp vào internals feature khác
 */
export function findBoundaryViolations(records, options = {}) {
  const sourceRoot = options.sourceRoot ?? process.cwd();
  const pathAliases = options.pathAliases ?? [];
  const featureScopes = options.featureScopes ?? new Set();

  const violations = [];

  const importPattern = /\b(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g;

  for (const record of records) {
    if (!record.file.endsWith('.ts')) {
      continue;
    }

    const sourceLayer = featureLayerFor(record.file, sourceRoot);

    const sourceFeature = featureFor(record.file, sourceRoot, featureScopes);

    for (const match of record.content.matchAll(importPattern)) {
      const specifier = match[1];

      const line = record.content.slice(0, match.index).split(/\r?\n/).length;

      /*
       * Domain tuyệt đối không phụ thuộc Angular.
       */
      if (sourceLayer === 'domain' && specifier.startsWith('@angular/')) {
        violations.push(
          violation(record.file, line, sourceLayer, 'Angular', 'domain cannot depend on Angular'),
        );

        continue;
      }

      const targetFile = resolveImportTarget(record.file, specifier, pathAliases);

      /*
       * Package ngoài như rxjs, qrcode...
       */
      if (!targetFile) {
        continue;
      }

      /*
       * Kiểm tra dependency direction:
       *
       * domain -> data-access/pages/ui: cấm
       * data-access -> pages/ui: cấm
       * ui -> data-access/pages: cấm
       */
      const targetLayer = featureLayerFor(targetFile, sourceRoot);

      if (
        sourceLayer &&
        sourceLayer in forbiddenLayerDependencies &&
        targetLayer &&
        forbiddenLayerDependencies[sourceLayer].has(targetLayer)
      ) {
        violations.push(
          violation(
            record.file,
            line,
            sourceLayer,
            targetLayer,
            `${sourceLayer} cannot depend on ${targetLayer}`,
          ),
        );

        continue;
      }

      /*
       * Kiểm tra feature encapsulation.
       *
       * Ví dụ:
       *
       * public/story
       * không được:
       *
       * import public/home/mock/...
       *
       * account/auth
       * không được:
       *
       * import account/profile/security/ui/...
       */
      const targetFeature = featureFor(targetFile, sourceRoot, featureScopes);

      if (
        sourceFeature &&
        targetFeature &&
        sourceFeature.key !== targetFeature.key &&
        !isAllowedCrossFeatureImport(targetFile, targetFeature, sourceRoot)
      ) {
        violations.push(
          violation(
            record.file,
            line,
            sourceLayer ?? sourceFeature.key,
            targetFeature.key,
            `${sourceFeature.key} cannot import internals of ${targetFeature.key}`,
          ),
        );
      }
    }
  }

  return violations;
}

function resolveAlias(specifier, alias) {
  const pattern = alias.pattern;
  const target = alias.target;

  const baseUrl = alias.baseUrl ?? process.cwd();

  /*
   * Alias không wildcard.
   */
  if (!pattern.includes('*')) {
    return specifier === pattern ? path.resolve(baseUrl, target) : null;
  }

  const [prefix, suffix] = pattern.split('*');

  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
    return null;
  }

  const wildcard = specifier.slice(prefix.length, specifier.length - suffix.length || undefined);

  return path.resolve(baseUrl, target.replace('*', wildcard));
}

function featureLayerFor(file, sourceRoot) {
  const relativeParts = relativePartsFor(file, sourceRoot);

  if (relativeParts[0] !== 'features') {
    return null;
  }

  return relativeParts.find((part) => featureLayers.has(part)) ?? null;
}

function featureFor(file, sourceRoot, featureScopes) {
  const parts = relativePartsFor(file, sourceRoot);

  if (parts[0] !== 'features') {
    return null;
  }

  const scope = parts[1];

  if (!scope || (featureScopes.size > 0 && !featureScopes.has(scope))) {
    return null;
  }

  const feature = parts[2];

  if (!feature) {
    return null;
  }

  return {
    scope,
    feature,
    key: `${scope}/${feature}`,
  };
}

function relativePartsFor(file, sourceRoot) {
  return path.relative(sourceRoot, file).split(path.sep).filter(Boolean);
}

function isAllowedCrossFeatureImport(targetFile, targetFeature, sourceRoot) {
  const parts = relativePartsFor(targetFile, sourceRoot);

  /*
   * features/<scope>/shared
   *
   * là vùng explicitly shared của scope đó.
   *
   * Ví dụ:
   * features/account/shared
   */
  if (targetFeature.feature === 'shared') {
    return true;
  }

  /*
   * Cho phép:
   *
   * @features/account/profile
   *
   * nếu profile expose public API qua index.ts.
   *
   * Không cho:
   *
   * @features/account/profile/security/ui/...
   */
  return parts.length === 3;
}

function violation(file, line, sourceLayer, target, message) {
  return {
    file,
    line,
    sourceLayer,
    target,
    message,
  };
}
