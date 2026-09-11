import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../.impeccable/review/feedback/', import.meta.url));
const base = process.env.KYNLIFT_PREVIEW_URL ?? 'http://127.0.0.1:4173';
await mkdir(output, { recursive: true });
const report = { capturedAt: new Date().toISOString(), base, pages: [], timerChecks: [], errors: [] };
const browser = await chromium.launch();

async function capture(page, size, view, fullPage = true) {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const name = `${size}-${view}`;
  await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: 'disabled' });
  report.pages.push({ name, ...await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const viewportWidth = document.documentElement.clientWidth;
    const selectedSet = document.querySelector('.set-tab[aria-current="step"]');
    const rail = document.querySelector('.set-tabs');
    const selectedRect = selectedSet?.getBoundingClientRect();
    const railRect = rail?.getBoundingClientRect();
    return {
      url: location.pathname,
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > viewportWidth,
      title: document.querySelector('main h1')?.textContent,
      selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null,
      overflowingElements: [...document.querySelectorAll('main *')].filter((element) => {
        if (!visible(element) || element.closest('.set-tabs, .progress-chart-data')) return false;
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1;
      }).slice(0, 12).map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent?.slice(0, 80) })),
      buttons: [...document.querySelectorAll('main button')].filter(visible).map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute('aria-label') ?? element.textContent, width: Math.round(rect.width), height: Math.round(rect.height), disabled: element.disabled };
      }),
      selectedSet: selectedRect && railRect ? {
        label: selectedSet.getAttribute('aria-label'),
        railScrollTop: rail.scrollTop,
        railScrollLeft: rail.scrollLeft,
        centerOffsetX: Math.round(selectedRect.left + selectedRect.width / 2 - railRect.left - railRect.width / 2),
        centerOffsetY: Math.round(selectedRect.top + selectedRect.height / 2 - railRect.top - railRect.height / 2),
      } : null,
    };
  }) });
}

async function home(page) {
  await page.getByRole('button', { name: 'Kynlift, vai all’allenamento', exact: true }).click();
  await page.getByRole('heading', { name: 'Le tue schede', exact: true }).waitFor();
}

try {
  for (const [size, viewport] of [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1440, height: 1000 }],
    ['narrow', { width: 320, height: 740 }],
  ]) {
    const mobile = size !== 'desktop';
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ size, type: 'pageerror', message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') report.errors.push({ size, type: 'console', message: message.text() });
    });
    page.on('dialog', (dialog) => dialog.accept());
    try {
      await page.clock.install({ time: new Date() });
      await page.goto(base);
      await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
      await page.getByRole('heading', { name: 'Le tue schede', exact: true }).waitFor();
      await capture(page, size, 'home');

      await page.locator(mobile ? '.bottom-nav' : '.desktop-nav').getByRole('button', { name: 'Schede', exact: true }).click();
      await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).waitFor();
      await capture(page, size, 'routines');
      // A long rail exercises automatic centering at every supported width.
      await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
      await page.getByLabel('Serie', { exact: true }).fill('12');
      await page.getByLabel('Recupero, secondi', { exact: true }).fill('90');
      await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
      await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).waitFor();
      await home(page);
      await page.getByRole('button', { name: 'Inizia Lower body A', exact: true }).click();
      await page.getByRole('heading', { name: 'Hip thrust', exact: true }).waitFor();
      await page.clock.fastForward(5_000);
      await capture(page, size, 'workout-work');

      await page.getByRole('button', { name: 'Serie 7', exact: true }).click();
      await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('60');
      await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).fill('10');
      await page.getByRole('textbox', { name: 'RIR', exact: true }).fill('2');
      await page.getByRole('textbox', { name: 'RIR', exact: true }).blur();
      await capture(page, size, 'workout-many-sets');
      await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
      await page.getByText('Recupero in corso', { exact: true }).waitFor();
      await capture(page, size, 'workout-rest');

      await page.getByRole('button', { name: 'Metti in pausa allenamento', exact: true }).click();
      await page.getByText('Allenamento in pausa', { exact: true }).waitFor();
      const pausedTime = await page.getByRole('timer').textContent();
      await page.clock.fastForward(10_000);
      const stillPausedTime = await page.getByRole('timer').textContent();
      report.timerChecks.push({ size, check: 'pause freezes timer', passed: pausedTime === stillPausedTime, before: pausedTime, after: stillPausedTime });
      await capture(page, size, 'workout-paused');

      await page.getByRole('button', { name: 'Riprendi allenamento', exact: true }).click();
      await page.clock.fastForward(95_000);
      await page.getByText('Tempo di esecuzione', { exact: true }).waitFor();
      const executionTime = await page.getByRole('timer').textContent();
      report.timerChecks.push({ size, check: 'execution starts after rest', passed: executionTime !== '00:00' && executionTime !== '0:00', value: executionTime });
      await capture(page, size, 'workout-after-rest');

      await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await capture(page, size, 'workout-advanced', false);
      await page.keyboard.press('Escape');
      await home(page);
      await page.getByRole('progressbar', { name: 'Avanzamento allenamento', exact: true }).waitFor();
      await capture(page, size, 'home-active');

      await page.locator(mobile ? '.bottom-nav' : '.desktop-nav').getByRole('button', { name: 'Progressi', exact: true }).click();
      for (const [tab, view] of [['Riepilogo', 'progress-summary'], ['Esercizi', 'progress-exercises'], ['Storico', 'progress-history']]) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.getByRole('combobox', { name: 'Periodo', exact: true }).selectOption('all');
        await capture(page, size, view);
      }
    } catch (error) {
      report.errors.push({ size, type: 'capture-flow', message: error.message });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/capture-report.json`, JSON.stringify(report, null, 2));
}

const summary = {
  output,
  screenshots: report.pages.length,
  overflow: report.pages.filter((page) => page.overflow).map((page) => page.name),
  timerChecks: report.timerChecks,
  errors: report.errors,
};
console.log(JSON.stringify(summary, null, 2));
if (summary.errors.length || summary.overflow.length || summary.timerChecks.some((check) => !check.passed)) process.exitCode = 1;
