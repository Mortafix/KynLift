import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url).pathname;
const output = `${root}.impeccable/review`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { capturedAt: new Date().toISOString(), pages: [], errors: [] };
const base = process.env.KYNLIFT_PREVIEW_URL ?? 'http://127.0.0.1:5173';

async function capture(page, name, fullPage = true, fromTop = true) {
  await page.evaluate(async (reset) => { await document.fonts.ready; if (reset) window.scrollTo(0, 0); }, fromTop);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: 'disabled' });
  report.pages.push({ name, ...await page.evaluate(() => ({
    url: location.pathname, width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    mainLandmarks: document.querySelectorAll('main').length,
    title: document.querySelector('main h1')?.textContent,
    primaryButtons: [...document.querySelectorAll('.button-primary')].map((element) => ({ text: element.textContent, height: element.getBoundingClientRect().height, top: element.getBoundingClientRect().top })),
  })) });
}
async function demo(page) {
  await page.goto(base);
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await page.getByRole('heading', { name: 'Le tue schede', exact: true }).waitFor();
}

for (const [size, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: size === 'mobile', hasTouch: size === 'mobile' });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push({ size, message: error.message }));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(base); await capture(page, `${size}-auth`);
  await demo(page); await capture(page, `${size}-home`);
  await page.goto(`${base}/schede`);
  await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
  await page.getByLabel('Serie', { exact: true }).fill('4');
  await capture(page, `${size}-editor`);
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await capture(page, `${size}-routines`);
  await page.getByRole('button', { name: 'Kynlift, vai all’allenamento', exact: true }).click();
  await page.getByRole('button', { name: 'Inizia Lower body A', exact: true }).click();
  await page.getByRole('heading', { name: 'Hip thrust', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Serie 2', exact: true }).click();
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('60');
  await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).fill('10');
  await page.getByRole('textbox', { name: 'RIR', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).blur();
  await capture(page, size);
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('dialog', { name: 'Opzioni avanzate', exact: true }).waitFor();
  await capture(page, `${size}-advanced`, false);
  await page.keyboard.press('Escape');
  if (size === 'mobile') {
    await capture(page, 'hero-repro', false);
    await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('');
    await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
    await capture(page, 'mobile-error');
    await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('60');
    await page.setViewportSize({ width: 390, height: 500 });
    await page.getByRole('textbox', { name: 'Peso', exact: true }).focus();
    await page.locator('.keyboard-open').waitFor();
    await capture(page, 'mobile-keyboard-height', false, false);
    await page.getByRole('textbox', { name: 'Peso', exact: true }).blur();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('1000.5');
    await page.getByRole('textbox', { name: 'Peso', exact: true }).blur();
    await capture(page, 'mobile-320');
    await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('60');
    await page.getByRole('button', { name: /^Esercizi/ }).click();
    await capture(page, 'mobile-exercises');
    await page.getByRole('button', { name: 'Chiudi elenco esercizi' }).click();
    await page.setViewportSize(viewport);
  }
  await page.goto(`${base}/progressi`); await page.getByRole('heading', { name: 'I tuoi progressi', exact: true }).waitFor();
  await capture(page, `${size}-progress`);
  await page.getByRole('tab', { name: 'Storico', exact: true }).click();
  await page.getByRole('combobox', { name: 'Periodo', exact: true }).selectOption('all');
  await page.getByRole('button', { name: /^Apri Lower body A del / }).first().click();
  await page.getByRole('heading', { name: 'Lower body A', exact: true }).waitFor();
  await page.locator('.history-set-row').first().waitFor();
  await capture(page, `${size}-history`);
  await page.goto(`${base}/catalogo`); await page.getByRole('heading', { name: 'Catalogo esercizi', exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Cerca nel catalogo' }).fill('esercizio inesistente');
  await capture(page, `${size}-catalog-empty`);
  await page.goto(`${base}/impostazioni`); await page.getByRole('heading', { name: 'Il tuo spazio.', exact: true }).waitFor();
  await capture(page, `${size}-settings`);
  await context.close();
}
await writeFile(`${output}/capture-report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
