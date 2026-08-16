import { randomUUID } from 'node:crypto';

const baseUrl =
  process.env.ANALYTICS_LOAD_TEST_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const storyId = process.env.ANALYTICS_LOAD_TEST_STORY_ID;
const chapterId = process.env.ANALYTICS_LOAD_TEST_CHAPTER_ID;
const eventsPerSecond = Math.max(
  1,
  Number(process.env.ANALYTICS_LOAD_TEST_EPS ?? 100),
);
const durationSeconds = Math.max(
  1,
  Number(process.env.ANALYTICS_LOAD_TEST_SECONDS ?? 30),
);

if (!storyId || !chapterId) {
  throw new Error(
    'ANALYTICS_LOAD_TEST_STORY_ID and ANALYTICS_LOAD_TEST_CHAPTER_ID are required',
  );
}

const anonymousReaderId = randomUUID();
const latencies: number[] = [];
let accepted = 0;
let failed = 0;

async function main(): Promise<void> {
  const total = eventsPerSecond * durationSeconds;
  const started = Date.now();
  for (let second = 0; second < durationSeconds; second += 1) {
    const batchPromises: Promise<void>[] = [];
    for (let i = 0; i < eventsPerSecond; i += 50) {
      const size = Math.min(50, eventsPerSecond - i);
      const events = Array.from({ length: size }, (_, index) => ({
        eventId: randomUUID(),
        type: index % 2 === 0 ? 'STORY_VIEW' : 'CHAPTER_VIEW',
        version: 1,
        sessionId: randomUUID(),
        storyId,
        ...(index % 2 === 0 ? {} : { chapterId }),
        occurredAt: new Date().toISOString(),
      }));
      batchPromises.push(send(events));
    }
    await Promise.all(batchPromises);
    const nextSecond = started + (second + 1) * 1000;
    const sleep = nextSecond - Date.now();
    if (sleep > 0) await new Promise((resolve) => setTimeout(resolve, sleep));
  }
  latencies.sort((a, b) => a - b);
  const p95 =
    latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0;
  console.log(
    JSON.stringify(
      {
        totalEvents: total,
        accepted,
        failed,
        requests: latencies.length,
        p95Ms: p95,
      },
      null,
      2,
    ),
  );
  if (failed > 0) process.exitCode = 1;
}

async function send(events: unknown[]): Promise<void> {
  const before = performance.now();
  try {
    const response = await fetch(`${baseUrl}/reader-analytics/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anonymousReaderId, events }),
    });
    latencies.push(performance.now() - before);
    if (!response.ok) {
      failed += events.length;
      return;
    }
    const body = (await response.json()) as { data?: { accepted?: number } };
    accepted += body.data?.accepted ?? events.length;
  } catch {
    latencies.push(performance.now() - before);
    failed += events.length;
  }
}

void main();
