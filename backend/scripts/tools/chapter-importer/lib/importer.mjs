import path from 'node:path';
import { AuthSession, sleep } from './session.mjs';
import { parseMultipleFiles } from './parser.mjs';
import {
  listStories,
  createStory,
  submitStory,
  adminApproveStory,
  listChapters,
  getChapterContent,
  createChapter,
  submitChapterReview,
  approveChapter,
  publishChapter,
} from './api.mjs';

const STEP_DELAY_MS = 150;

// Curly quotes/dashes vs straight ones are visually identical but different
// Unicode code points, so a plain .includes() match silently fails and (with
// --create-title set) creates a duplicate story instead of finding the real
// one — this has actually happened. Normalize both sides before comparing.
function normalizeForMatch(text) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ′]/gu, "'")
    .replace(/[“”″]/gu, '"')
    .replace(/[–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeTitle(title) {
  return normalizeForMatch(title).replace(/\s+/gu, ' ').trim();
}

export function buildSessions({ baseUrl, sessionDir, authorCreds, adminCreds, onLog }) {
  const author = new AuthSession(baseUrl, path.join(sessionDir, 'author.json'), {
    ...authorCreds,
    label: 'tác giả',
    onLog,
  });
  const admin = new AuthSession(baseUrl, path.join(sessionDir, 'admin.json'), {
    ...adminCreds,
    label: 'admin',
    onLog,
  });
  return { author, admin };
}

/**
 * Finds an existing story matching `hint` (case-insensitive substring against
 * title), or creates one titled `createTitle` if given and nothing matches.
 */
export async function matchOrCreateStory({ authorSession, hint, createTitle, onLog }) {
  const stories = await listStories(authorSession);
  const normalizedHint = normalizeForMatch(hint ?? '');
  let match = normalizedHint
    ? stories.find((s) => normalizeForMatch(s.title).includes(normalizedHint))
    : undefined;

  if (!match && createTitle) {
    // Last-chance safety net before creating a possibly-duplicate story: the
    // hint may have failed to match (typo, different punctuation) even
    // though createTitle itself is an exact copy of an existing story's
    // name — this has actually caused a real duplicate story once. Catch
    // that specific case by comparing createTitle directly.
    const exactExisting = stories.find(
      (s) => normalizeForMatch(s.title) === normalizeForMatch(createTitle),
    );
    if (exactExisting) {
      onLog?.(
        `[!] "${createTitle}" trùng khớp chính xác với truyện đã có "${exactExisting.title}" (hint "${hint}" không khớp do khác biệt nhỏ, VD dấu nháy) — dùng truyện có sẵn thay vì tạo mới.`,
      );
      return exactExisting;
    }
    onLog?.(`Không thấy truyện khớp "${hint}" -> tạo mới: "${createTitle}"`);
    match = await createStory(authorSession, createTitle);
    onLog?.(`  -> tạo xong id=${match.id} status=${match.status}`);
    return match;
  }

  if (!match) {
    throw new Error(
      `Không tìm thấy truyện khớp hint "${hint}". Danh sách hiện có: ${stories.map((s) => s.title).join(' | ')}`,
    );
  }
  return match;
}

function normalizeContent(content) {
  return content.toLowerCase().replace(/\s+/gu, ' ').trim();
}

// A title match alone is NOT proof of a real duplicate: bare "Chương N"
// titles with no subtitle reset every volume (so volume 2's "Chương 1" has
// the same title as volume 1's, with completely different content), and
// generic section labels ("Lời bạt", "Ngoại truyện") legitimately recur too.
// Both false-positive modes have actually happened in testing and silently
// dropped real content, so title match only *nominates* a candidate — the
// content itself decides. Two chapters count as the same content when their
// normalized length is within 2% and their first 200 characters match.
function looksLikeSameContent(a, b) {
  const na = normalizeContent(a);
  const nb = normalizeContent(b);
  if (na.length === 0 || nb.length === 0) return na === nb;
  const lengthRatio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  if (lengthRatio < 0.98) return false;
  return na.slice(0, 200) === nb.slice(0, 200);
}

/**
 * Detects duplicates against chapters already published/drafted in the
 * target story — catches "this exact file was already imported" mistakes
 * before wasting a batch of API calls on them. A title match only nominates
 * a candidate; it's only treated as a real duplicate (and skipped) once the
 * content itself is confirmed to match. Title matches whose content differs
 * are still created, just flagged for review, since re-used titles across
 * volumes are common and legitimate.
 */
export async function detectExistingDuplicates({ authorSession, storyId, chapters }) {
  const existing = await listChapters(authorSession, storyId);
  const existingByTitle = new Map();
  for (const c of existing) {
    const key = normalizeTitle(c.title);
    if (!existingByTitle.has(key)) existingByTitle.set(key, []);
    existingByTitle.get(key).push(c);
  }

  const contentCache = new Map();
  const getContent = async (chapterId) => {
    if (!contentCache.has(chapterId)) {
      contentCache.set(chapterId, await getChapterContent(authorSession, storyId, chapterId));
    }
    return contentCache.get(chapterId);
  };

  const duplicates = [];
  const reviewSameTitleDifferentContent = [];
  const fresh = [];
  for (const chapter of chapters) {
    const candidates = existingByTitle.get(normalizeTitle(chapter.title)) ?? [];
    if (candidates.length === 0) {
      fresh.push(chapter);
      continue;
    }
    let matchedExisting = false;
    for (const candidate of candidates) {
      const existingContent = await getContent(candidate.id);
      if (looksLikeSameContent(chapter.content, existingContent)) {
        matchedExisting = true;
        break;
      }
    }
    if (matchedExisting) {
      duplicates.push(chapter);
    } else {
      reviewSameTitleDifferentContent.push(chapter);
      fresh.push(chapter);
    }
  }
  return { duplicates, reviewSameTitleDifferentContent, fresh, existingCount: existing.length };
}

/**
 * Drives every non-PUBLISHED chapter in the story through submit -> approve
 * -> publish, re-reading each chapter's live `version` from the server right
 * before mutating it. This makes the pipeline crash-safe and idempotent by
 * construction: re-running it after a partial failure (network blip, expired
 * token, process killed mid-run) simply finishes whatever is left, whether
 * this run created those chapters or an earlier one did.
 */
export async function reconcile({ authorSession, adminSession, storyId, onLog }) {
  const summary = { submitOk: 0, submitFail: 0, approveOk: 0, approveFail: 0, publishOk: 0, publishFail: 0 };

  let chapters = await listChapters(authorSession, storyId);
  const drafts = chapters.filter((c) => c.status === 'DRAFT');
  onLog?.(`--- Submit review (${drafts.length} chương DRAFT) ---`);
  for (const chapter of drafts) {
    try {
      await submitChapterReview(authorSession, storyId, chapter.id, chapter.version);
      summary.submitOk += 1;
    } catch (err) {
      summary.submitFail += 1;
      onLog?.(`  !! submit ${chapter.id} lỗi: ${err.message}`);
    }
    await sleep(STEP_DELAY_MS);
  }

  chapters = await listChapters(authorSession, storyId);
  const inReview = chapters.filter((c) => c.status === 'IN_REVIEW');
  onLog?.(`--- Admin approve (${inReview.length} chương IN_REVIEW) ---`);
  for (const chapter of inReview) {
    try {
      await approveChapter(adminSession, chapter.id, chapter.version);
      summary.approveOk += 1;
    } catch (err) {
      summary.approveFail += 1;
      onLog?.(`  !! approve ${chapter.id} lỗi: ${err.message}`);
    }
    await sleep(STEP_DELAY_MS);
  }

  chapters = await listChapters(authorSession, storyId);
  const approved = chapters.filter((c) => c.status === 'APPROVED');
  onLog?.(`--- Publish (${approved.length} chương APPROVED) ---`);
  for (const chapter of approved) {
    try {
      await publishChapter(authorSession, storyId, chapter.id);
      summary.publishOk += 1;
    } catch (err) {
      summary.publishFail += 1;
      onLog?.(`  !! publish ${chapter.id} lỗi: ${err.message}`);
    }
    await sleep(STEP_DELAY_MS);
  }

  return summary;
}

/**
 * Full pipeline: match/create story -> skip already-existing titles -> create
 * the rest -> get the story itself published if it's still DRAFT/REJECTED ->
 * reconcile every non-PUBLISHED chapter through to PUBLISHED.
 */
export async function runImport({
  authorSession,
  adminSession,
  storyHint,
  createStoryTitle,
  chapters,
  skipExistingDuplicates = true,
  onLog = () => {},
}) {
  await authorSession.ensureReady();
  await adminSession.ensureReady();

  const story = await matchOrCreateStory({
    authorSession,
    hint: storyHint,
    createTitle: createStoryTitle,
    onLog,
  });
  onLog(`Truyện: slug=${story.slug ?? '(mới)'} id=${story.id} status=${story.status}`);

  let toCreate = chapters;
  let skipped = [];
  if (skipExistingDuplicates) {
    const dedup = await detectExistingDuplicates({ authorSession, storyId: story.id, chapters });
    toCreate = dedup.fresh;
    skipped = dedup.duplicates;
    if (skipped.length > 0) {
      onLog(
        `Bỏ qua ${skipped.length} chương đã tồn tại trong truyện (trùng cả tiêu đề lẫn nội dung): ${skipped
          .slice(0, 5)
          .map((c) => c.title)
          .join(' | ')}${skipped.length > 5 ? '…' : ''}`,
      );
    }
    if (dedup.reviewSameTitleDifferentContent.length > 0) {
      onLog(
        `[!] ${dedup.reviewSameTitleDifferentContent.length} chương trùng TÊN với chương đã có nhưng nội dung khác nhau (thường do đánh số lại mỗi tập, hoặc tên chung như "Lời Bạt") — vẫn tạo mới vì nội dung thực sự khác. Tự kiểm tra nếu nghi ngờ: ${dedup.reviewSameTitleDifferentContent
          .map((c) => c.title)
          .join(' | ')}`,
      );
    }
  }

  onLog(`--- Tạo chương (${toCreate.length} chương mới) ---`);
  const createdIds = [];
  for (const [index, chapter] of toCreate.entries()) {
    const created = await createChapter(authorSession, story.id, chapter);
    createdIds.push(created.id);
    onLog(`  [${index + 1}/${toCreate.length}] ${chapter.title} -> id=${created.id} number=${created.number}`);
    await sleep(STEP_DELAY_MS);
  }

  if (story.status === 'DRAFT' || story.status === 'REJECTED') {
    onLog('--- Truyện chưa publish -> submit + admin approve truyện ---');
    const submission = await submitStory(authorSession, story.id);
    const approved = await adminApproveStory(adminSession, submission.submission.id);
    story.status = approved.story.status;
    onLog(`  -> story status: ${story.status}`);
  }

  const reconcileSummary = await reconcile({ authorSession, adminSession, storyId: story.id, onLog });

  return {
    story,
    createdCount: toCreate.length,
    skippedDuplicateCount: skipped.length,
    ...reconcileSummary,
  };
}

export { parseMultipleFiles };
