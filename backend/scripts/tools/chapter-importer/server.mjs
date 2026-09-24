#!/usr/bin/env node
/**
 * Local GUI for the chapter importer. Zero external dependencies (plain
 * node:http) — serves public/index.html and a small JSON+SSE API that wraps
 * lib/importer.mjs. Run with:
 *
 *   node server.mjs [--port=5177]
 *
 * Then open http://localhost:5177 in a browser.
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { AuthSession } from './lib/session.mjs';
import { parseMultipleFiles } from './lib/parser.mjs';
import { listStories, listChapters } from './lib/api.mjs';
import { runImport } from './lib/importer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DIR = path.join(__dirname, '.sessions');
const UPLOAD_DIR = path.join(__dirname, '.uploads');

function sanitizeFileName(name) {
  const base = path.basename(name || 'upload.txt').replace(/[^\w.\-À-ỹ ]/gu, '_');
  return base.length > 0 ? base : 'upload.txt';
}

const PORT = Number(
  process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 5177,
);

// baseUrl+role -> AuthSession. Kept in server memory for the life of the
// process; each session also persists its refresh token to disk so it
// survives a server restart without a fresh TOTP.
const sessions = new Map();

function getSession(baseUrl, role, creds) {
  const key = `${baseUrl}::${role}`;
  let session = sessions.get(key);
  if (!session) {
    session = new AuthSession(baseUrl, path.join(SESSION_DIR, `${role}.json`), {
      label: role,
      onLog: () => {},
    });
    sessions.set(key, session);
  }
  if (creds) {
    session.credentials = { ...session.credentials, ...creds, label: role };
  }
  return session;
}

// jobId -> { logs: string[], done: boolean, error: string|null, result: object|null, listeners: Set<ServerResponse> }
const jobs = new Map();

function createJob() {
  const id = randomUUID();
  jobs.set(id, { logs: [], done: false, error: null, result: null, listeners: new Set() });
  return id;
}

function jobLog(id, line) {
  const job = jobs.get(id);
  if (!job) return;
  job.logs.push(line);
  for (const res of job.listeners) {
    res.write(`event: log\ndata: ${JSON.stringify(line)}\n\n`);
  }
}

function jobFinish(id, { error, result }) {
  const job = jobs.get(id);
  if (!job) return;
  job.done = true;
  job.error = error ?? null;
  job.result = result ?? null;
  const payload = JSON.stringify({ error: job.error, result: job.result });
  for (const res of job.listeners) {
    res.write(`event: done\ndata: ${payload}\n\n`);
    res.end();
  }
  job.listeners.clear();
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

async function handleApi(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/session/login') {
    const { baseUrl, role, identifier, password, totp } = await readJson(req);
    const session = getSession(baseUrl, role, { identifier, password, totp });
    try {
      await session.ensureReady();
      sendJson(res, 200, { ok: true, expiresAt: session.accessTokenExpiresAt });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/session/status') {
    const baseUrl = url.searchParams.get('baseUrl');
    const role = url.searchParams.get('role');
    const session = getSession(baseUrl, role);
    if (!session.hasCookies()) await session.load();
    sendJson(res, 200, {
      hasCookies: session.hasCookies(),
      expiringSoon: session.isExpiringSoon(),
      expiresAt: session.accessTokenExpiresAt,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/stories') {
    const { baseUrl } = await readJson(req);
    const session = getSession(baseUrl, 'author');
    try {
      const stories = await listStories(session);
      sendJson(res, 200, { stories });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/upload') {
    const originalName = url.searchParams.get('name') ?? 'upload.txt';
    const safeName = sanitizeFileName(originalName);
    await mkdir(UPLOAD_DIR, { recursive: true });
    const uniqueDir = path.join(UPLOAD_DIR, randomUUID());
    await mkdir(uniqueDir, { recursive: true });
    const destPath = path.join(uniqueDir, safeName);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    await writeFile(destPath, buffer);

    sendJson(res, 200, { path: destPath, name: safeName, size: buffer.length });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/detect') {
    const { paths, pattern } = await readJson(req);
    try {
      const texts = await Promise.all(paths.map((p) => readFile(p, 'utf8')));
      const { chapters, warnings } = parseMultipleFiles(texts, { customPattern: pattern });
      sendJson(res, 200, {
        totalChapters: chapters.length,
        warnings,
        preview: chapters.map((c) => ({ title: c.title, length: c.content.length })),
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/import') {
    const { baseUrl, paths, pattern, storyHint, createStoryTitle, force } = await readJson(req);
    const jobId = createJob();
    sendJson(res, 200, { jobId });

    (async () => {
      try {
        const texts = await Promise.all(paths.map((p) => readFile(p, 'utf8')));
        const { chapters, warnings } = parseMultipleFiles(texts, { customPattern: pattern });
        for (const w of warnings) jobLog(jobId, `[!] ${w}`);
        jobLog(jobId, `Phát hiện ${chapters.length} chương từ ${paths.length} file.`);

        const author = getSession(baseUrl, 'author');
        const admin = getSession(baseUrl, 'admin');
        author.onLog = (line) => jobLog(jobId, `[tác giả] ${line}`);
        admin.onLog = (line) => jobLog(jobId, `[admin] ${line}`);

        const result = await runImport({
          authorSession: author,
          adminSession: admin,
          storyHint,
          createStoryTitle,
          chapters,
          skipExistingDuplicates: !force,
          onLog: (line) => jobLog(jobId, line),
        });
        jobFinish(jobId, { result });
      } catch (err) {
        jobLog(jobId, `LỖI: ${err.message}`);
        jobFinish(jobId, { error: err.message });
      }
    })();
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/import/') && url.pathname.endsWith('/stream')) {
    const jobId = url.pathname.split('/')[3];
    const job = jobs.get(jobId);
    if (!job) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    for (const line of job.logs) res.write(`event: log\ndata: ${JSON.stringify(line)}\n\n`);
    if (job.done) {
      res.write(`event: done\ndata: ${JSON.stringify({ error: job.error, result: job.result })}\n\n`);
      res.end();
      return;
    }
    job.listeners.add(res);
    req.on('close', () => job.listeners.delete(res));
    return;
  }

  res.writeHead(404).end();
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => sendJson(res, 500, { error: err.message }));
  } else {
    serveStatic(req, res, url.pathname);
  }
});

server.listen(PORT, () => {
  console.log(`Chapter importer GUI: http://localhost:${PORT}`);
});
