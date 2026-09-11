import { chromium } from '@playwright/test';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import site from '../site.config.json' with { type: 'json' };

const regular = 'node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff2';
const condensed = 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2';
await mkdir('public/fonts', { recursive: true });
await copyFile(regular, 'public/fonts/barlow-latin-400-normal.woff2');
await copyFile(condensed, 'public/fonts/barlow-condensed-latin-600-normal.woff2');
await copyFile('node_modules/@fontsource/barlow/LICENSE', 'public/fonts/Barlow-LICENSE.txt');
await copyFile('node_modules/@fontsource/barlow-condensed/LICENSE', 'public/fonts/Barlow-Condensed-LICENSE.txt');
const html = (await readFile('scripts/social-card.html', 'utf8'))
  .replace('__BARLOW__', (await readFile(regular)).toString('base64'))
  .replace('__CONDENSED__', (await readFile(condensed)).toString('base64'))
  .replace('__HOST__', new URL(site.url).host);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public${site.socialImage}` });
  console.log(`Anteprima social generata: public${site.socialImage} (1200×630).`);
} finally { await browser.close(); }
