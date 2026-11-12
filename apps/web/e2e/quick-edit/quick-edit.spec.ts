import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01A_TITLE } from '../footage';

/**
 * Quick Edit on a REAL AI clip (S01a, already ingested + transcribed in the dev database): open the editor from the
 * clip page, change the opening title, autosave, reload → the change is there; then another tab saves a newer
 * version first and this tab keeps editing → the version conflict is resolved without losing either change.
 * Needs the dev stack started by `scripts/dev.sh`.
 */
test.describe.configure({ timeout: 600_000, mode: 'serial' });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/quick-edit-${name}.png`, fullPage: true });

type Clips = { runId: string; status: string; clips: { status: string; projectId: string | null }[] };
type Doc = { elements: Record<string, { type: string; content?: string; startFrame: number }> };

test('edit the opening title, autosave, reload; a second tab saves first and nothing is lost', async ({
  page,
  context,
}) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  const src = readySource(list.items, S01A_TITLE);
  test.skip(!src, 'S01a is not ingested in this dev database');
  const sourceId = src?.id ?? '';
  const started = (await (
    await page.request.post(`/api/sources/${sourceId}/clips`, {
      data: { productName: 'Liquid Blue', fresh: true, styleId: 'sale-fast' },
    })
  ).json()) as Clips;
  let state = started;
  await expect
    .poll(
      async () => {
        state = (await (await page.request.get(`/api/sources/${sourceId}/clips`)).json()) as Clips;
        return state.runId === started.runId ? state.status : 'other';
      },
      { timeout: 300_000, intervals: [2000] },
    )
    .toBe('succeeded');
  const projectId = state.clips.find((c) => c.status === 'ready')?.projectId ?? '';

  await page.goto(`/clips/${projectId}`);
  await page.getByTestId('open-editor').click();
  await expect(page).toHaveURL(new RegExp(`/clips/${projectId}/edit$`));
  await expect(page.getByTestId('quick-edit')).toBeVisible();
  const first = page.getByTestId('text-input').first();
  await expect(page.getByTestId('captions-panel')).toBeVisible();
  await shot(page, '1-open');

  // captions tab (default): fix a caption word → saved, still there after reload
  const word = page.getByTestId('caption-word').nth(1);
  await word.click();
  await page.getByTestId('caption-word-input').fill('ทดสอบแก้คำ');
  await page.getByTestId('caption-word-input').press('Enter');
  await expect(page.getByTestId('caption-word').nth(1)).toHaveText('ทดสอบแก้คำ');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await shot(page, '1b-caption-edited');
  await page.reload();
  await expect(page.getByTestId('caption-word').nth(1)).toHaveText('ทดสอบแก้คำ');

  // caption look + position for the whole clip
  await page.getByRole('tab', { name: 'สไตล์' }).click();
  await page.getByTestId('look-boxed').click();
  await expect(page.getByTestId('look-boxed')).toHaveAttribute('data-selected', 'true');
  await page.getByTestId('style-panel').getByText('บน', { exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await shot(page, '1c-style');
  const styled = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as {
    doc: { elements: Record<string, { type: string; styleRef?: string; transform?: { y: number } }> };
  };
  const caps = Object.values(styled.doc.elements).filter((e) => e.type === 'caption');
  expect(caps.every((c) => c.styleRef === 'boxed' && c.transform?.y === -420)).toBe(true);

  // crop: the real S01a source is already portrait → nothing to slide, said plainly
  await page.getByRole('tab', { name: 'ครอบภาพ' }).click();
  await expect(page.getByTestId('reframe-none')).toBeVisible();

  // add a text at the playhead, then remove it
  await page.getByRole('tab', { name: 'ข้อความ' }).click();
  const before = await page.getByTestId('text-input').count();
  await page.getByTestId('add-text').click();
  await expect(page.getByTestId('text-input')).toHaveCount(before + 1);
  await page.getByTestId('text-remove').first().click();
  await expect(page.getByTestId('text-input')).toHaveCount(before);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('text-input')).toHaveCount(before + 1);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('text-input')).toHaveCount(before);

  // edit the opening title (Enter commits one command) → autosave
  await first.fill('ลดเหลือ 50 บาทวันนี้');
  await first.press('Enter');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await page.reload();
  await page.getByRole('tab', { name: 'ข้อความ' }).click();
  await expect(page.getByTestId('text-input').first()).toHaveValue('ลดเหลือ 50 บาทวันนี้');
  await shot(page, '2-after-reload');

  // undo restores the previous text in the form and on the stage, redo brings it back
  await page.getByTestId('text-input').first().fill('ชั่วคราว');
  await page.getByTestId('text-input').first().press('Enter');
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('text-input').first()).toHaveValue('ลดเหลือ 50 บาทวันนี้');
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('text-input').first()).toHaveValue('ชั่วคราว');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });

  // a second tab saves a newer version first (changes the LAST text), then this tab edits the FIRST text
  const other = await context.newPage();
  await other.goto(`/clips/${projectId}/edit`);
  await other.getByRole('tab', { name: 'ข้อความ' }).click();
  const last = other.getByTestId('text-input').last();
  await last.fill('ข้อความจากอีกแท็บ');
  await last.press('Enter');
  await expect(other.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await page.getByTestId('text-input').first().fill('แก้จากแท็บแรก');
  await page.getByTestId('text-input').first().press('Enter');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 20_000 });

  // the server now has BOTH changes
  const saved = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as { doc: Doc };
  const texts = Object.values(saved.doc.elements)
    .filter((e) => e.type === 'text')
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((e) => e.content);
  expect(texts[0]).toBe('แก้จากแท็บแรก');
  expect(texts.at(-1)).toBe('ข้อความจากอีกแท็บ');
  await shot(page, '3-after-conflict');
  await other.close();
});
