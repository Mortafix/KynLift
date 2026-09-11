import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page) {
  await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
}

async function expectFullShell(page: Page, height: number, safeTop = 0, safeBottom = 0) {
  await expect.poll(async () => (await page.locator('.app-shell').boundingBox())?.height).toBe(height);
  const header = await page.locator('.app-header').boundingBox();
  const main = await page.locator('#main-content').boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(safeTop);
  expect(nav!.y + nav!.height).toBe(height);
  expect(main!.y + main!.height).toBe(nav!.y);
  const tab = await page.locator('.bottom-nav button').first().boundingBox();
  expect(tab!.y + tab!.height).toBeLessThanOrEqual(height - safeBottom);
  expect(await page.evaluate(() => ({ scrollY, height: document.documentElement.scrollHeight }))).toEqual({ scrollY: 0, height });
}

test('ogni pagina mobile riempie lo schermo, protegge le safe area e scorre nel contenuto', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');
  // Browser emulation does not expose a physical notch or home indicator.
  await page.addStyleTag({ content: ':root { --safe-area-top: 59px; --safe-area-bottom: 34px; }' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const login = await page.locator('.auth-screen').boundingBox();
  const loginHeader = await page.locator('.auth-header').boundingBox();
  expect(login!.height).toBe(874);
  expect(loginHeader!.y).toBeGreaterThanOrEqual(59);
  await enterDemo(page);
  await expectFullShell(page, 874, 59, 34);

  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede', exact: true }).click();
  await page.getByRole('button', { name: 'Catalogo esercizi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalogo esercizi', exact: true })).toBeVisible();
  await expectFullShell(page, 874, 59, 34);
  await page.locator('#main-content').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => page.locator('#main-content').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const lastEdit = page.locator('.catalog-row').last().getByRole('button');
  await lastEdit.click();
  await expect(page.getByRole('heading', { name: 'Modifica esercizio', exact: true })).toBeInViewport({ ratio: 1 });
  await expect.poll(() => page.locator('#main-content').evaluate((element) => element.scrollTop)).toBe(0);
  const save = page.getByRole('button', { name: 'Salva esercizio', exact: true });
  await expect(save).toBeInViewport({ ratio: 1 });
  const saveBox = await save.boundingBox();
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual((await page.locator('.bottom-nav').boundingBox())!.y);
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();

  for (const tab of ['Progressi', 'Allenamento']) {
    await page.locator('.bottom-nav').getByRole('button', { name: tab, exact: true }).click();
    await expectFullShell(page, 874, 59, 34);
    await expect.poll(() => page.locator('#main-content').evaluate((element) => element.scrollTop)).toBe(0);
  }
  await page.getByRole('button', { name: 'Apri impostazioni account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Il tuo account', exact: true })).toBeVisible();
  await expectFullShell(page, 874, 59, 34);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Allenamento', exact: true }).click();
  await page.getByRole('button', { name: 'Apri Lower body A', exact: true }).click();
  await expectFullShell(page, 874, 59, 34);
  await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hip thrust', exact: true })).toBeVisible();
  await expectFullShell(page, 874, 59, 34);
  await expect(page.getByRole('button', { name: 'Salva serie', exact: true })).toBeInViewport({ ratio: 1 });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 720, height: 900 }]) {
  test(`altezza nativa a ${viewport.width}px anche quando visualViewport riporta una misura precedente`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const staleViewport = new EventTarget();
      Object.defineProperties(staleViewport, { height: { value: 640 }, offsetTop: { value: 0 }, width: { get: () => innerWidth }, scale: { value: 1 } });
      Object.defineProperty(window, 'visualViewport', { value: staleViewport });
    });
    await page.goto('/');
    expect((await page.locator('.auth-screen').boundingBox())!.height).toBe(viewport.height);
    await enterDemo(page);
    await expectFullShell(page, viewport.height);
    await page.getByRole('button', { name: 'Apri Lower body A', exact: true }).click();
    await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Hip thrust', exact: true })).toBeVisible();
    await expectFullShell(page, viewport.height);
    const next = await page.getByRole('button', { name: 'Successivo', exact: true }).boundingBox();
    expect(next!.y + next!.height).toBeLessThanOrEqual((await page.locator('.bottom-nav').boundingBox())!.y);
    await expect(page.getByRole('button', { name: 'Salva serie', exact: true })).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: viewport.width, height: viewport.height + 80 });
    await expectFullShell(page, viewport.height + 80);
  });
}
