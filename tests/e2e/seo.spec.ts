import { expect, test } from '@playwright/test';
import site from '../../site.config.json' with { type: 'json' };

test('la home è leggibile senza JavaScript e i controlli statici non inviano credenziali', async ({ browser, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain(`rel="canonical" href="${site.url}/"`);
  expect(html).toContain(`content="${site.url}${site.socialImage}"`);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Il tuo allenamento,');
    await expect(page.getByRole('button', { name: 'Esplora la demo' })).toBeDisabled();
    expect(await page.locator('noscript').textContent()).toContain('JavaScript');
    await expect(page.locator('noscript p')).toBeVisible();
    const schema = JSON.parse(await page.locator('#site-schema').textContent() || '{}');
    expect(schema.url).toBe(`${site.url}/`);
  } finally { await context.close(); }
});

test('la navigazione privata aggiorna titoli e rimuove i metadati pubblici', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await expect(page).toHaveTitle('Allenamento — Kynlift');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"], #site-schema, meta[property^="og:"]')).toHaveCount(0);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede' }).click();
  await expect(page).toHaveTitle('Schede — Kynlift');
  await page.goBack();
  await expect(page).toHaveTitle('Allenamento — Kynlift');
  await page.reload();
  await expect(page).toHaveTitle('Allenamento — Kynlift');
});

test('shell privata e 404 sono già noindex nella risposta HTML', async ({ request }) => {
  for (const path of ['/app.html', '/404.html']) {
    const html = await (await request.get(path)).text();
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('application/ld+json');
  }
});

test('la PWA riapre una rotta personale offline e non intercetta gli helper Auth', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await expect(page).toHaveTitle('Allenamento — Kynlift');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede' }).click();
  await expect(page).toHaveTitle('Schede — Kynlift');
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('Schede — Kynlift');
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  const helper = await context.newPage();
  await expect(helper.goto('http://127.0.0.1:4173/__/auth/iframe')).rejects.toThrow();
  await context.setOffline(false);
});
