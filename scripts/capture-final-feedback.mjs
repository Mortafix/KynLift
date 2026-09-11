import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../.impeccable/review/routine-entry/', import.meta.url));
const base = process.env.KYNLIFT_PREVIEW_URL ?? 'http://127.0.0.1:4173';
await mkdir(output, { recursive: true });
const report = { capturedAt: new Date().toISOString(), pages: [], errors: [] };
const browser = await chromium.launch();
async function capture(page, name, fullPage = true) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: 'disabled' });
  const geometry = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const bottom = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight;
    const controls = ['.save-set-button', '.exercise-pagination'].flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element || getComputedStyle(element).display === 'none') return [];
      const box = element.getBoundingClientRect();
      return [{ selector, top: box.top, bottom: box.bottom, fits: box.top >= 0 && box.bottom <= bottom + 1 }];
    });
    return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, fixedWorkout: !document.querySelector('.workout-page') || document.documentElement.scrollHeight <= innerHeight, fixedAuth: !document.querySelector('.auth-screen') || document.documentElement.scrollHeight <= innerHeight, controls, cardHeights: [...document.querySelectorAll('.main-number-fields > .number-field')].map((field) => Math.round(field.getBoundingClientRect().height)) };
  });
  report.pages.push({ name, ...geometry });
}
try {
  for (const [size, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }], ['narrow', { width: 320, height: 740 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: size !== 'desktop', hasTouch: size !== 'desktop' });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ size, message: error.message }));
    try {
      await page.goto(base);
      await expect(page.getByRole('button', { name: 'Esplora la demo' })).toBeVisible();
      await expect(page.locator('.auth-story > p, .auth-privacy, .demo-entry > span')).toHaveCount(0);
      await expect(page.getByText('Accedi e riprendi da dove eri rimasto.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Bentornato in pista.', { exact: true })).toHaveCount(0);
      await capture(page, `${size}-login`);
      await page.getByRole('button', { name: 'Esplora la demo' }).click();
      await expect(page).toHaveURL(`${base}/allenamento`);
      await page.getByRole('button', { name: 'Apri impostazioni account' }).click();
      await expect(page.locator('.account-identity')).toContainText('Arnold Schwarzenegger');
      await capture(page, `${size}-profile`);
      const reset = await page.getByRole('button', { name: 'Ripristina demo', exact: true }).boundingBox();
      const logout = await page.getByRole('button', { name: 'Esci dalla demo', exact: true }).boundingBox();
      expect(Math.abs(reset.y - logout.y)).toBeLessThan(1);
      await page.getByRole('button', { name: 'Esci dalla demo', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Esplora la demo' })).toBeVisible();
      await page.getByRole('button', { name: 'Esplora la demo' }).click();
      await expect(page).toHaveURL(`${base}/allenamento`);
      await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
      await page.getByRole('button', { name: 'Gestisci', exact: true }).click();
      await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
      await page.getByLabel('Serie', { exact: true }).fill('12');
      await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
      await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
      await page.getByRole('button', { name: 'Apri Lower body A', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Lower body A', exact: true })).toBeVisible();
      await capture(page, `${size}-routine-summary`);
      await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
      await page.getByRole('button', { name: 'Serie 8', exact: true }).click();
      await capture(page, `${size}-workout`, false);
      await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Serie 8, completata', exact: true })).toHaveCount(1);
      if (size === 'narrow') {
        await page.getByRole('button', { name: /^Esercizi/ }).click();
        await page.getByRole('dialog', { name: 'Esercizi', exact: true }).getByRole('button', { name: /Bulgarian split squat/ }).click();
        await capture(page, 'narrow-workout-long-name', false);
      }
      if (size === 'mobile') {
        await page.setViewportSize({ width: 390, height: 500 });
        await page.getByRole('textbox', { name: 'RIR', exact: true }).focus();
        await capture(page, 'mobile-keyboard', false);
        await page.getByRole('textbox', { name: 'RIR', exact: true }).blur();
        await page.setViewportSize(viewport);
      }
      await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
      await page.getByRole('button', { name: /Termina allenamento/ }).click();
      const finish = page.getByRole('dialog', { name: 'Termina allenamento', exact: true });
      await expect(finish.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true })).toHaveValue('7');
      await finish.getByRole('radio', { name: 'Alta', exact: true }).check();
      await capture(page, `${size}-finish`, false);
      await finish.getByRole('button', { name: 'Annulla', exact: true }).click();
      await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
      await page.getByRole('button', { name: 'Annulla allenamento', exact: true }).click();
      const cancel = page.getByRole('alertdialog');
      await expect(cancel).not.toContainText(/allenamento/i);
      await expect(cancel.getByRole('button', { name: 'Conferma', exact: true })).toBeVisible();
      await capture(page, `${size}-cancel`, false);
      await cancel.getByRole('button', { name: 'Riprendi', exact: true }).click();
    } catch (error) { report.errors.push({ size, message: error.message }); }
    finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
const failures = report.pages.filter((page) => page.overflow || !page.fixedWorkout || !page.fixedAuth || page.controls.some((control) => !control.fits));
console.log(JSON.stringify({ output, screenshots: report.pages.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
