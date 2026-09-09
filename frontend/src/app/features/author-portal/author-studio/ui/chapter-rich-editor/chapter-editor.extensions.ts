import { Extensions, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

export function isSafeEditorUrl(value: string, image = false): boolean {
  const url = value.trim();
  if (
    !url ||
    [...url].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    return false;
  if (/^(?:\/[^/]|#[^\s])/u.test(url)) return true;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', ...(image ? [] : ['mailto:'])].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const ChapterImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const src: unknown = HTMLAttributes['src'];
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: typeof src === 'string' && isSafeEditorUrl(src, true) ? src : undefined,
      }),
    ];
  },
  renderMarkdown(node) {
    const alt = String(node.attrs?.['alt'] ?? '').replace(/[\\[\]]/gu, '\\$&');
    const src = String(node.attrs?.['src'] ?? '').replace(/[\s()]/gu, (character) =>
      character === '(' ? '%28' : character === ')' ? '%29' : encodeURIComponent(character),
    );
    const title = String(node.attrs?.['title'] ?? '').replace(/[\\"]/gu, '\\$&');
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
});

/** Markdown remains the API format; canonical block IDs are reconciled by the server. */
export function chapterEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      underline: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: false,
        markdownLinks: true,
        isAllowedUri: (url) => isSafeEditorUrl(url),
      },
    }),
    ChapterImage.configure({ inline: true, allowBase64: false }),
    TableKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Bắt đầu viết chương của bạn…' }),
    CharacterCount,
    Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
  ];
}
