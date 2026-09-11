import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url).pathname;
const browser = await chromium.launch();
const results = [];
for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: name === 'mobile', hasTouch: name === 'mobile' });
  const page = await context.newPage();
  await page.goto(process.env.KYNLIFT_PREVIEW_URL ?? 'http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await page.getByRole('heading', { name: 'Le tue schede', exact: true }).waitFor();
  for (const variant of ['home', 'home-active']) {
    if (variant === 'home-active') {
      await page.getByRole('button', { name: 'Inizia Lower body A', exact: true }).click();
      await page.getByRole('textbox', { name: 'Peso', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
      await page.getByRole('heading', { name: 'Le tue schede', exact: true }).waitFor();
    }
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    await page.screenshot({ path: `${root}.impeccable/review/${name}-${variant}.png`, fullPage: true, animations: 'disabled' });
    results.push({ name: `${name}-${variant}`, ...await page.evaluate(() => {
      const header = document.querySelector('.home-header').getBoundingClientRect();
      const routines = document.querySelector('.home-routines').getBoundingClientRect();
      const progress = document.querySelector('[role="progressbar"]');
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, headingBottom: header.bottom, routinesTop: routines.top, routinesFollowHeading: routines.top >= header.bottom, activeProgress: progress?.getAttribute('aria-valuetext') ?? null };
    }) });
  }
  await context.close();
}
await browser.close();
await writeFile(`${root}.impeccable/review/home-verdict-capture.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
