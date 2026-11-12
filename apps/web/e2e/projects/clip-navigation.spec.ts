import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

let ownedFolder: string | undefined;
test.afterEach(async ({ page }) => {
  if (ownedFolder) {
    expect((await page.request.delete(`/api/folders/${ownedFolder}`)).status()).toBe(204);
    ownedFolder = undefined;
  }
});

test('clip thumbnails, back links and active navigation follow the originating project through both editors', async ({
  page,
}) => {
  await signIn(page, '/clips');
  const projects = (await (await page.request.get('/api/projects')).json()) as { items: { id: string }[] };
  let chosen:
    | { id: string; title: string; doc: { assets: Record<string, { sourceId?: string; kind: string }> } }
    | undefined;
  for (const project of projects.items) {
    const record = (await (await page.request.get(`/api/projects/${project.id}`)).json()) as NonNullable<
      typeof chosen
    >;
    if (Object.values(record.doc.assets).some((asset) => asset.sourceId && asset.kind === 'video')) {
      chosen = record;
      break;
    }
  }
  expect(chosen, 'a real editable clip must be present in the dev database').toBeDefined();
  const clip = chosen!;
  const sourceId = Object.values(clip.doc.assets).find((asset) => asset.sourceId && asset.kind === 'video')!
    .sourceId!;
  const created = await page.request.post('/api/folders', { data: { title: 'ตรวจการย้อนกลับ' } });
  expect(created.status()).toBe(201);
  ownedFolder = ((await created.json()) as { id: string }).id;
  expect(
    (
      await page.request.post(`/api/folders/${ownedFolder}/sources`, { data: { sourceIds: [sourceId] } })
    ).status(),
  ).toBe(200);
  const folderPath = `/projects/${ownedFolder}`;
  await page.goto(folderPath);
  const originalBack = await page.getByRole('link', { name: 'โปรเจกต์ทั้งหมด', exact: true }).boundingBox();
  const card = page.locator(`[data-testid="edited-clip"][href^="/clips/${clip.id}"]`);
  await expect(card).toBeVisible();
  await card.click();
  const back = page.getByTestId('page-back');
  await expect(back).toHaveAttribute('href', folderPath);
  await expect(
    page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: 'โปรเจกต์', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const box = await back.boundingBox();
  expect(Math.abs(box!.x - originalBack!.x)).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(back).toHaveAttribute('href', folderPath);
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return !!video && video.readyState >= 2 && !video.seeking;
  });
  const editBox = await page.getByTestId('open-editor').boundingBox();
  const exportBox = await page.getByRole('region', { name: 'ส่งออกเป็นวิดีโอ', exact: true }).boundingBox();
  const previewBox = await page.getByTestId('preview-player').boundingBox();
  expect(
    Math.abs(editBox!.x - exportBox!.x),
    'editing and export actions share a left edge',
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(editBox!.y - previewBox!.y), 'actions start beside the preview').toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/clip-back-alignment.png', fullPage: true });
  await page.getByTestId('open-editor').click();
  await expect(back).toHaveAttribute('href', new RegExp(`/clips/${clip.id}\\?project=${ownedFolder}$`));
  await page.getByTestId('open-advanced').click();
  await expect(back).toHaveAttribute('href', new RegExp(`/clips/${clip.id}/edit\\?project=${ownedFolder}$`));
  await back.click();
  await back.click();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`${folderPath}$`));
  const thumb = page
    .locator(`[data-clip-id="${clip.id}"]`)
    .getByRole('img', { name: `ภาพตัวอย่างคลิป ${clip.title}`, exact: true });
  await expect(thumb).toBeVisible();
  await expect(thumb).toHaveCSS('background-image', /\/api\/sources\/.+\/sprites\//);
  await page.screenshot({ path: 'test-results/project-clips-thumbnails.png', fullPage: true });
  await page.locator(`[data-testid="source-card-link"][href^="/library/${sourceId}"]`).click();
  await expect(back).toHaveAttribute('href', folderPath);
  await expect(
    page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: 'โปรเจกต์', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto(`/clips/${clip.id}?source=${sourceId}`);
  await expect(back).toHaveAttribute('href', `/library/${sourceId}`);
  await expect(
    page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: 'คลังวิดีโอ', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto(`/clips/${clip.id}`);
  await expect(back).toHaveAttribute('href', '/clips');
  await expect(
    page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: 'คลิปที่ตัดแล้ว', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
