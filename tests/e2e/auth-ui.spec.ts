import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('accesso fisso mantiene i campi e le azioni raggiungibili con tastiera e registrazione', async ({ page, context }) => {
  const externalRequests: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4175') await route.continue();
    else { externalRequests.push(url.origin); await route.abort(); }
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('http://127.0.0.1:4175/');
  await expect(page.getByText('Bentornato in pista.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Esplora la demo', exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Crea un account', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 400 });
  for (const name of ['Il tuo nome', 'Email', 'Password']) {
    const input = page.getByLabel(name, { exact: true });
    await input.focus();
    await expect(input).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('button', { name: 'Crea account', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Crea account', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Ingresso demo richiesto');
  expect(externalRequests).toEqual([]);
});
