#!/usr/bin/env node
/**
 * Generalized chapter importer — CLI.
 *
 * Splits one or more plain-text files into chapters (auto-detecting the
 * heading style), then drives them through the site's real author+admin API
 * all the way to PUBLISHED: create -> submit-review -> admin-approve ->
 * publish. Never touches the database directly.
 *
 * Usage:
 *   node cli.mjs --base-url=https://example.com \
 *     --input=chapters1.txt --input=chapters2.txt \
 *     --story="existing story title substring" \
 *     [--create-title="Brand New Story Title"] \
 *     [--pattern="custom regex for heading lines"] \
 *     [--author-id=... --author-password=... --author-totp=123456] \
 *     [--admin-id=... --admin-password=... --admin-totp=123456] \
 *     [--session-dir=./.sessions] [--dry-run] [--force]
 *
 * Credentials can also come from env vars: AUTHOR_IDENTIFIER, AUTHOR_PASSWORD,
 * AUTHOR_TOTP, ADMIN_IDENTIFIER, ADMIN_PASSWORD, ADMIN_TOTP. Once a session
 * has logged in once, its refresh token is persisted under --session-dir, so
 * TOTP is only needed again after ~30 days or an explicit logout.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMultipleFiles } from './lib/parser.mjs';
import { buildSessions, runImport } from './lib/importer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { input: [] };
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    const value = eq === -1 ? true : raw.slice(eq + 1);
    if (key === 'input') {
      args.input.push(value);
    } else {
      args[key] = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = args['base-url'] ?? process.env.IMPORT_BASE_URL;
  if (!baseUrl) throw new Error('Thiếu --base-url (hoặc env IMPORT_BASE_URL).');
  if (args.input.length === 0) throw new Error('Cần ít nhất một --input=<file>.');

  const texts = await Promise.all(args.input.map((p) => readFile(p, 'utf8')));
  const { chapters, warnings } = parseMultipleFiles(texts, {
    customPattern: args.pattern,
  });

  console.log(`Phát hiện ${chapters.length} chương từ ${args.input.length} file.`);
  for (const w of warnings) console.log(`  [!] ${w}`);
  console.log('Xem trước:');
  for (const c of chapters.slice(0, 3)) console.log(`  - ${c.title} (${c.content.length} ký tự)`);
  if (chapters.length > 3) console.log(`  ... và ${chapters.length - 3} chương khác`);

  if (args['dry-run']) {
    console.log('\n(--dry-run: dừng lại ở bước xem trước, không gọi API.)');
    return;
  }

  const sessionDir = args['session-dir'] ?? path.join(__dirname, '.sessions');
  const { author, admin } = buildSessions({
    baseUrl,
    sessionDir,
    authorCreds: {
      identifier: args['author-id'] ?? process.env.AUTHOR_IDENTIFIER,
      password: args['author-password'] ?? process.env.AUTHOR_PASSWORD,
      totp: args['author-totp'] ?? process.env.AUTHOR_TOTP,
    },
    adminCreds: {
      identifier: args['admin-id'] ?? process.env.ADMIN_IDENTIFIER,
      password: args['admin-password'] ?? process.env.ADMIN_PASSWORD,
      totp: args['admin-totp'] ?? process.env.ADMIN_TOTP,
    },
    onLog: (line) => console.log(`  [session] ${line}`),
  });

  const result = await runImport({
    authorSession: author,
    adminSession: admin,
    storyHint: args.story,
    createStoryTitle: args['create-title'],
    chapters,
    skipExistingDuplicates: !args.force,
    onLog: (line) => console.log(line),
  });

  console.log('\nHoàn tất:');
  console.log(
    `  tạo mới=${result.createdCount} bỏ-qua-trùng=${result.skippedDuplicateCount} ` +
      `submit(${result.submitOk}/${result.submitOk + result.submitFail}) ` +
      `approve(${result.approveOk}/${result.approveOk + result.approveFail}) ` +
      `publish(${result.publishOk}/${result.publishOk + result.publishFail})`,
  );
}

main().catch((err) => {
  console.error('LỖI:', err.message ?? err);
  process.exitCode = 1;
});
