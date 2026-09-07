const baseUrl = requireEnv('MONETIZATION_SECURITY_TEST_BASE_URL').replace(
  /\/$/u,
  '',
);
const storySlug = requireEnv('MONETIZATION_SECURITY_TEST_STORY_SLUG');
const chapterNumber = requireEnv('MONETIZATION_SECURITY_TEST_CHAPTER_NUMBER');
const fullContentSentinel = requireEnv(
  'MONETIZATION_SECURITY_TEST_FULL_CONTENT_SENTINEL',
);
const outsiderAccessToken =
  process.env.MONETIZATION_SECURITY_TEST_OUTSIDER_TOKEN;

void main();

async function main(): Promise<void> {
  const targets = [
    { name: 'anonymous', accessToken: undefined },
    ...(outsiderAccessToken
      ? [{ name: 'non-entitled', accessToken: outsiderAccessToken }]
      : []),
  ];

  for (const target of targets) {
    const response = await fetch(
      `${baseUrl}/stories/${encodeURIComponent(storySlug)}/chapters/${encodeURIComponent(chapterNumber)}`,
      {
        headers: target.accessToken
          ? { authorization: `Bearer ${target.accessToken}` }
          : {},
      },
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${target.name} reader returned HTTP ${response.status}`);
    }
    if (text.includes(fullContentSentinel)) {
      throw new Error(
        `${target.name} response leaked the full-content sentinel`,
      );
    }
    const body = JSON.parse(text) as {
      data?: { chapter?: Record<string, unknown> };
      chapter?: Record<string, unknown>;
    };
    const chapter = body.data?.chapter ?? body.chapter;
    const access = chapter?.access as { state?: string } | undefined;
    if (!chapter || access?.state !== 'LOCKED') {
      throw new Error(`${target.name} response was not the LOCKED variant`);
    }
    if ('content' in chapter || 'contentFormat' in chapter) {
      throw new Error(`${target.name} response included a full-content field`);
    }
  }

  console.log(
    JSON.stringify({
      result: 'pass',
      checked: targets.map((item) => item.name),
    }),
  );
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
