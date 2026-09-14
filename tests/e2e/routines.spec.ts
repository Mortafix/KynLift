import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });
test.use({ viewport: { width: 1280, height: 900 } });

function navigation(page: Page) {
  return page.getByRole('navigation', { name: 'Navigazione principale', exact: true });
}

function routineCard(page: Page, name: string) {
  return page.getByRole('article').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
}

function exerciseEditor(page: Page, name: string) {
  return page.getByRole('article').filter({
    has: page.getByRole('button', { name: `Sposta ${name} prima`, exact: true }),
  });
}

async function addExercise(page: Page, name: string) {
  await page.getByRole('button', { name: 'Aggiungi esercizio', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cerca un esercizio da aggiungere' }).fill(name);
  await page.getByRole('button', { name: `Aggiungi ${name}`, exact: true }).click();
  await expect(exerciseEditor(page, name)).toBeVisible();
}

async function openCatalog(page: Page) {
  await page.getByRole('button', { name: 'Catalogo esercizi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalogo esercizi', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
  await expect(page.getByText('Stai provando Kynlift con dati di esempio.', { exact: false })).toBeVisible();
  await navigation(page).getByRole('button', { name: 'Schede', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
  await expect(routineCard(page, 'Lower body A')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inizia allenamento', exact: true })).toHaveCount(0);
});

test('crea una scheda e riordina la copia senza cambiare l’originale, anche dopo la riapertura', async ({ page }) => {
  const originalName = 'Forza test';
  const copiedName = 'Forza test B';
  await page.getByRole('button', { name: 'Nuova scheda', exact: true }).click();
  await page.getByLabel('Nome della scheda', { exact: true }).fill(originalName);
  await page.getByLabel('Descrizione', { exact: false }).fill('Scheda creata dal flusso completo.');
  await addExercise(page, 'Back squat');
  await page.getByLabel('Serie', { exact: true }).fill('4');
  await page.getByLabel('Rep min.', { exact: true }).fill('6');
  await page.getByLabel('Rep max.', { exact: true }).fill('8');
  await page.getByLabel('Recupero (s)', { exact: true }).fill('120');
  await page.getByLabel('RIR', { exact: false }).fill('2');
  await addExercise(page, 'Shoulder press');
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();

  const original = routineCard(page, originalName);
  await expect(original).toContainText('7 serie');
  await expect(original).toContainText('Back squat / Shoulder press');
  await original.getByRole('button', { name: `Duplica ${originalName}`, exact: true }).click();
  await expect(routineCard(page, `${originalName} · copia`)).toBeVisible();
  await page.getByRole('button', { name: `Modifica ${originalName} · copia`, exact: true }).click();
  await page.getByLabel('Nome della scheda', { exact: true }).fill(copiedName);
  await page.getByRole('button', { name: 'Sposta Shoulder press prima', exact: true }).click();
  await exerciseEditor(page, 'Shoulder press').getByRole('button', { expanded: false }).click();
  await page.getByLabel('Serie', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();

  await expect(routineCard(page, copiedName)).toContainText('9 serie');
  await expect(routineCard(page, copiedName)).toContainText('Shoulder press / Back squat');
  await expect(original).toContainText('7 serie');
  await expect(original).toContainText('Back squat / Shoulder press');

  await page.reload();
  await expect(routineCard(page, originalName)).toContainText('7 serie');
  await expect(routineCard(page, copiedName)).toContainText('Shoulder press / Back squat');
  await page.getByRole('button', { name: `Modifica ${copiedName}`, exact: true }).click();
  await expect(page.getByRole('article').first()).toContainText('Shoulder press');
  await expect(page.getByLabel('Serie', { exact: true })).toHaveValue('5');
  await exerciseEditor(page, 'Back squat').getByRole('button', { expanded: false }).click();
  await expect(page.getByLabel('Serie', { exact: true })).toHaveValue('4');
  await expect(page.getByLabel('Rep min.', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('Rep max.', { exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Recupero (s)', { exact: true })).toHaveValue('120');
  await expect(page.getByLabel('RIR', { exact: false })).toHaveValue('2');
});

test('MAX si sceglie per singola serie e conserva le ripetizioni reali e lo snapshot nello storico', async ({ page }) => {
  await page.getByRole('button', { name: 'Nuova scheda', exact: true }).click();
  await page.getByLabel('Nome della scheda', { exact: true }).fill('Serie a cedimento');
  await addExercise(page, 'Dip alle parallele');
  await page.getByRole('checkbox', { name: 'Serie 3', exact: true }).check();
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await expect(routineCard(page, 'Serie a cedimento')).toBeVisible();
  await page.reload();
  await navigation(page).getByRole('button', { name: 'Allenamento', exact: true }).click();
  await page.getByRole('button', { name: 'Apri Serie a cedimento', exact: true }).click();
  await expect(page.locator('.routine-preview-max')).toHaveText('MAX: serie 3');
  await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
  await expect(page.locator('.workout-target:not(.previous-weight)')).toContainText('8–12 ripetizioni');
  await expect(page.locator('.number-max-label')).toHaveCount(0);
  await page.getByRole('button', { name: 'Serie 3', exact: true }).click();
  await expect(page.locator('.workout-target:not(.previous-weight)')).toContainText('MAX ripetizioni');
  await expect(page.locator('#set-reps-max')).toHaveText('MAX');
  await expect(page.getByRole('textbox', { name: 'Ripetizioni', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Controlla la serie' })).toContainText('ripetizioni');
  await page.getByRole('button', { name: 'Torna alla serie', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).fill('14');
  await page.getByRole('textbox', { name: 'RIR', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 3, completata', exact: true })).toBeVisible();
  await navigation(page).getByRole('button', { name: 'Schede', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Serie a cedimento', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Serie 3', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await page.locator('.resume-strip').click();
  await expect(page.locator('.workout-target:not(.previous-weight)')).toContainText('MAX ripetizioni');
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('button', { name: /Termina allenamento/ }).click();
  const finish = page.getByRole('dialog', { name: 'Termina allenamento', exact: true });
  await finish.locator('input[type="radio"][value="4"]').check();
  await finish.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
  await expect(page.locator('.history-set-row')).toHaveCount(1);
  await expect(page.locator('.history-max-label')).toHaveText('MAX');
  await expect(page.locator('.history-set-row strong').last()).toHaveText('14');
  await page.reload();
  await expect(page.locator('.history-max-label')).toHaveText('MAX');
  await expect(page.locator('.history-set-row strong').last()).toHaveText('14');
});

test('duplica MAX, seleziona tutte e rimuove i riferimenti alle serie eliminate senza modificare l’originale', async ({ page }) => {
  await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Serie 3', exact: true }).check();
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await page.getByRole('button', { name: 'Duplica Lower body A', exact: true }).click();
  await expect(routineCard(page, 'Lower body A · copia')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Modifica Lower body A · copia', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Serie 3', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Serie 2', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Tutte', exact: true }).check();
  await expect(page.getByLabel('Rep min.', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Rep max.', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await expect(routineCard(page, 'Lower body A · copia')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Modifica Lower body A · copia', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Tutte', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Tutte', exact: true }).uncheck();
  await expect(page.getByLabel('Rep min.', { exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Rep max.', { exact: true })).toHaveValue('10');
  await page.getByRole('checkbox', { name: 'Serie 3', exact: true }).check();
  await page.getByLabel('Serie', { exact: true }).fill('2');
  await page.getByLabel('Serie', { exact: true }).fill('3');
  await expect(page.getByRole('checkbox', { name: 'Serie 3', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Serie 3', exact: true })).toBeChecked();
});

test('salva un esercizio personalizzato e lo usa in una scheda proteggendolo dalla cancellazione', async ({ page }) => {
  const exerciseName = 'Rematore test unilaterale';
  const routineName = 'Scheda custom test';
  await openCatalog(page);
  await page.getByRole('button', { name: 'Nuovo esercizio', exact: true }).click();
  await page.getByLabel('Nome dell’esercizio', { exact: true }).fill(exerciseName);
  await page.getByLabel('Attrezzatura', { exact: true }).fill('Manubrio test');
  await page.getByRole('combobox', { name: 'Gruppo muscolare', exact: true }).selectOption('Dorso');
  await page.getByRole('combobox', { name: 'Tipo di carico', exact: true }).selectOption('per-hand');
  await page.getByRole('combobox', { name: 'Carichi conteggiati nel volume', exact: true }).selectOption('1');
  await page.getByRole('checkbox', { name: /Registra i lati separatamente/ }).check();
  await page.getByLabel('Incremento rapido, kg', { exact: true }).fill('1,25');
  await page.getByRole('button', { name: 'Salva esercizio', exact: true }).click();
  await expect(page.getByRole('heading', { name: exerciseName, exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: `Modifica ${exerciseName}`, exact: true }).click();
  await expect(page.getByLabel('Attrezzatura', { exact: true })).toHaveValue('Manubrio test');
  await expect(page.getByRole('combobox', { name: 'Gruppo muscolare', exact: true })).toHaveValue('Dorso');
  await expect(page.getByRole('combobox', { name: 'Tipo di carico', exact: true })).toHaveValue('per-hand');
  await expect(page.getByRole('combobox', { name: 'Carichi conteggiati nel volume', exact: true })).toHaveValue('1');
  await expect(page.getByRole('checkbox', { name: /Registra i lati separatamente/ })).toBeChecked();
  await expect(page.getByLabel('Incremento rapido, kg', { exact: true })).toHaveValue('1,25');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await page.getByRole('button', { name: 'Torna alle schede', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova scheda', exact: true }).click();
  await page.getByLabel('Nome della scheda', { exact: true }).fill(routineName);
  await addExercise(page, exerciseName);
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await expect(routineCard(page, routineName)).toContainText(exerciseName);
  await expect(routineCard(page, routineName).getByRole('button', { name: `Modifica ${routineName}`, exact: true })).toBeEnabled();

  await openCatalog(page);
  await page.getByRole('button', { name: `Modifica ${exerciseName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Elimina dal catalogo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(`“${exerciseName}” è usato in “${routineName}”`);
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.getByRole('heading', { name: exerciseName, exact: true })).toBeVisible();
});

test('modificare scheda e catalogo conserva nomi, convenzioni e serie nello storico già completato', async ({ page }) => {
  await navigation(page).getByRole('button', { name: 'Progressi', exact: true }).click();
  await page.getByRole('tab', { name: 'Storico', exact: true }).click();
  await page.getByRole('combobox', { name: 'Periodo', exact: true }).click();
  await page.getByRole('option', { name: 'Sempre', exact: true }).click();
  await page.getByRole('button', { name: /^Apri Lower body A del / }).first().click();
  await expect(page.getByRole('heading', { name: 'Lower body A', exact: true })).toBeVisible();
  const historyUrl = page.url();
  const headingsBefore = await page.getByRole('heading', { level: 2 }).allTextContents();
  const historicalSets = page.getByRole('button', { name: /^Modifica .+, serie \d+:/ });
  const setsBefore = await historicalSets.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
  expect(setsBefore.length).toBeGreaterThan(0);
  await expect(page.getByText('Bilanciere · kg totali', { exact: true })).toHaveCount(2);

  await navigation(page).getByRole('button', { name: 'Schede', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
  await page.getByLabel('Nome della scheda', { exact: true }).fill('Lower aggiornato test');
  await page.getByLabel('Serie', { exact: true }).fill('5');
  await page.getByLabel('Rep min.', { exact: true }).fill('6');
  await page.getByLabel('Rep max.', { exact: true }).fill('7');
  await page.getByLabel('Nota sull’esercizio', { exact: false }).fill('Solo per i prossimi allenamenti.');
  await page.getByRole('button', { name: 'Sposta Hip thrust dopo', exact: true }).click();
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await expect(routineCard(page, 'Lower aggiornato test')).toBeVisible();
  await openCatalog(page);
  await page.getByRole('button', { name: 'Modifica Hip thrust', exact: true }).click();
  await page.getByLabel('Nome dell’esercizio', { exact: true }).fill('Hip thrust nuovo test');
  await page.getByLabel('Attrezzatura', { exact: true }).fill('Manubri test');
  await page.getByRole('combobox', { name: 'Tipo di carico', exact: true }).selectOption('per-hand');
  await page.getByRole('button', { name: 'Salva esercizio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hip thrust nuovo test', exact: true })).toBeVisible();

  await page.goto(historyUrl);
  await expect(page.getByRole('heading', { name: 'Lower body A', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(headingsBefore);
  await expect(page.getByText('Bilanciere · kg totali', { exact: true })).toHaveCount(2);
  await expect(historicalSets).toHaveCount(setsBefore.length);
  expect(await historicalSets.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual(setsBefore);
  await expect(page.getByText('Solo per i prossimi allenamenti.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Hip thrust nuovo test', exact: true })).toHaveCount(0);
});
