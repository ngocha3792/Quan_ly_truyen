import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { assertProductionServerRuntimeConfig } from './app/core/config/app-runtime-config.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
});
const runningAsMain = isMainModule(import.meta.url);
let browserIndexPromise: Promise<string> | null = null;

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (runningAsMain && url.pathname === '/health') {
    await writeHealthResponse(response);
    return;
  }

  if (runningAsMain && url.pathname === '/index.html') {
    const html = await loadBrowserIndex();
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(html);
    return;
  }

  const angularResponse = await angularApp.handle(request);

  if (angularResponse) {
    await writeResponseToNodeResponse(angularResponse, response);
    return;
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

async function writeHealthResponse(response: ServerResponse): Promise<void> {
  try {
    await loadBrowserIndex();
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('ok');
  } catch {
    response.writeHead(503, {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('frontend artifact unavailable');
  }
}

function loadBrowserIndex(): Promise<string> {
  browserIndexPromise ??= readBrowserIndex();
  return browserIndexPromise;
}

async function readBrowserIndex(): Promise<string> {
  const candidates = ['index.csr.html', 'index.html'];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await readFile(resolve(browserDistFolder, candidate), 'utf8');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Angular browser index was not found.');
}

export const reqHandler = createNodeRequestHandler(async (request, response) => {
  await handleRequest(request, response);
});

export default reqHandler;

if (runningAsMain) {
  assertProductionServerRuntimeConfig();
  const port = readPort(process.env['PORT']);
  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      console.error('Unhandled frontend SSR request error.', error);

      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }

      response.end('Internal server error');
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`TruyenHub SSR server listening on http://0.0.0.0:${port}`);
  });
}

function readPort(rawPort: string | undefined): number {
  const port = Number(rawPort ?? '8080');

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}
