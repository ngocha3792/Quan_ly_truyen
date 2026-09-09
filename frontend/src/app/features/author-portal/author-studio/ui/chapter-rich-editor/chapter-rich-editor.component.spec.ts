import { TestBed } from '@angular/core/testing';

import { ChapterRichEditorComponent } from './chapter-rich-editor.component';

describe('ChapterRichEditorComponent', () => {
  it('initializes after rendering, emits toolbar edits, and tears down the editable DOM', async () => {
    const fixture = TestBed.createComponent(ChapterRichEditorComponent);
    fixture.componentRef.setInput('content', 'Nội dung');
    const changes: string[] = [];
    fixture.componentInstance.contentChange.subscribe((value) => changes.push(value));
    fixture.detectChanges();
    TestBed.tick();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const textbox = host.querySelector<HTMLElement>('[role="textbox"]');
    expect(textbox?.textContent).toBe('Nội dung');
    expect(changes).toEqual([]);

    const heading = host.querySelector('select')!;
    heading.value = '2';
    heading.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(changes.at(-1)).toBe('## Nội dung');
    expect(host.querySelector('h2')?.textContent).toBe('Nội dung');

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(textbox?.getAttribute('contenteditable')).toBe('false');
    expect(fixture.componentInstance.insertImage('https://example.com/image.webp', 'Ảnh')).toBe(
      false,
    );
    fixture.destroy();
    expect(host.querySelector('[contenteditable]')).toBeNull();
  });
});
