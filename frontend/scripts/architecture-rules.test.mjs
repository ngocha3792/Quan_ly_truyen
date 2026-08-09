import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  findBoundaryViolations,
  resolveImportTarget,
} from './architecture-rules.mjs';

const workspaceRoot =
  path.join(
    process.cwd(),

    '__architecture_test__',
  );

const sourceRoot =
  path.join(
    workspaceRoot,

    'src',

    'app',
  );

const aliases = [
  {
    pattern: '@features/*',

    target:
      'src/app/features/*',

    baseUrl: workspaceRoot,
  },

  {
    pattern: '@shared/*',

    target:
      'src/app/shared/*',

    baseUrl: workspaceRoot,
  },
];

const featureScopes =
  new Set([
    'public',
    'account',
    'admin',
    'author-portal',
  ]);

const file = (...parts) =>
  path.join(
    sourceRoot,

    ...parts,
  );

const violationsFor = (
  recordFile,
  content,
) =>
  findBoundaryViolations(
    [
      {
        file: recordFile,

        content,
      },
    ],

    {
      sourceRoot,

      pathAliases: aliases,

      featureScopes,
    },
  );

test(
  'resolve configured wildcard alias',

  () => {
    assert.equal(
      resolveImportTarget(
        file(
          'features',
          'public',
          'story',
          'domain',
          'story.ts',
        ),

        '@features/public/story/data-access/story.repository',

        aliases,
      ),

      file(
        'features',
        'public',
        'story',
        'data-access',
        'story.repository',
      ),
    );
  },
);

test(
  'catch forbidden layer dependency through alias',

  () => {
    const violations =
      violationsFor(
        file(
          'features',
          'public',
          'story',
          'domain',
          'story.ts',
        ),

        `
          import { repository }
            from '@features/public/story/data-access/story.repository';
        `,
      );

    assert.equal(
      violations.length,

      1,
    );

    assert.match(
      violations[0].message,

      /domain cannot depend on data-access/,
    );
  },
);

test(
  'catch cross-feature internal import through alias',

  () => {
    const violations =
      violationsFor(
        file(
          'features',
          'public',
          'story',
          'data-access',
          'story.ts',
        ),

        `
          import { HOME_DATA }
            from '@features/public/home/mock/home.mock';
        `,
      );

    assert.equal(
      violations.length,

      1,
    );

    assert.match(
      violations[0].message,

      /public\/story cannot import internals of public\/home/,
    );
  },
);

test(
  'allow scoped shared feature import',

  () => {
    const violations =
      violationsFor(
        file(
          'features',
          'account',
          'auth',
          'ui',
          'auth.ts',
        ),

        `
          import { Dialog }
            from '@features/account/shared/ui/dialog';
        `,
      );

    assert.deepEqual(
      violations,

      [],
    );
  },
);

test(
  'allow explicit feature public API',

  () => {
    const violations =
      violationsFor(
        file(
          'features',
          'public',
          'story',
          'pages',
          'page.ts',
        ),

        `
          import { homeApi }
            from '@features/public/home';
        `,
      );

    assert.deepEqual(
      violations,

      [],
    );
  },
);

test(
  'domain still cannot import Angular',

  () => {
    const violations =
      violationsFor(
        file(
          'features',
          'public',
          'story',
          'domain',
          'story.ts',
        ),

        `
          import { signal }
            from '@angular/core';
        `,
      );

    assert.equal(
      violations.length,

      1,
    );

    assert.match(
      violations[0].message,

      /domain cannot depend on Angular/,
    );
  },
);