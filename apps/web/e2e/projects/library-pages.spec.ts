import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

test('Library loads another page without losing existing footage', async ({ page }) => {
  // Exercise real API cursor pagination using small pages; every source record is from the dev database.
  await page.route('**/api/sources?*', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('limit', '1');
    await route.fulfill({ response: await route.fetch({ url: url.toString() }) });
  });
  await signIn(page, '/library');
  const actual = (await (await page.request.get('/api/sources?limit=2')).json()) as {
    items: { id: string }[];
  };
  test.skip(actual.items.length < 2, 'requires two uploaded dev sources');
  await expect(page.getByTestId('source-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'โหลดวิดีโอเพิ่ม', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'โหลดวิดีโอเพิ่ม', exact: true }).click();
  await expect(page.getByTestId('source-card')).toHaveCount(2);
  for (const source of actual.items)
    await expect(
      page.locator(`[data-testid="source-card-link"][href="/library/${source.id}"]`),
    ).toBeVisible();
});
