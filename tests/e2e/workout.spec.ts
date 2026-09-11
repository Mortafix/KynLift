import { expect, test, type Page } from '@playwright/test';

async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
}

async function startLower(page: Page) {
  await page.getByRole('button', { name: 'Apri Lower body A', exact: true }).click();
  await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hip thrust', exact: true })).toBeVisible();
}

async function finishFeedback(page: Page, energy = '4', sleep = '7,5', note = '') {
  const dialog = page.getByRole('dialog', { name: 'Termina allenamento', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.locator(`input[type="radio"][value="${energy}"]`).check();
  await dialog.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true }).fill(sleep);
  if (note) await dialog.getByRole('textbox', { name: /Note aggiuntive/ }).fill(note);
  await dialog.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
}

async function selectPeriod(page: Page, label: string) {
  await page.getByRole('combobox', { name: 'Periodo', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('il riepilogo non avvia sessioni e un doppio tocco su Inizia crea un solo allenamento', async ({ page }) => {
  const activeCount = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('kinlift-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const docs = await new Promise<Array<{ collection: string; value: { status?: string } }>>((resolve, reject) => { const request = db.transaction('documents').objectStore('documents').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    return docs.filter((row) => row.collection === 'sessions' && row.value.status === 'active').length;
  });
  await demo(page);
  await page.getByRole('button', { name: 'Apri Lower body A', exact: true }).click();
  await expect(page).toHaveURL(/\/allenamento\/scheda\//);
  await expect(page.getByRole('list', { name: 'Esercizi della scheda' }).getByRole('listitem')).toHaveCount(5);
  expect(await activeCount()).toBe(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lower body A', exact: true })).toBeVisible();
  expect(await activeCount()).toBe(0);
  await page.getByRole('button', { name: 'Torna alle schede', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apri Lower body A', exact: true }).click();
  await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).dblclick();
  await expect(page).toHaveURL('/allenamento/sessione');
  await expect.poll(activeCount).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hip thrust', exact: true })).toBeVisible();
  expect(await activeCount()).toBe(1);
});

test('entrare e rientrare nella demo apre sempre il tab Allenamento', async ({ page }) => {
  await page.goto('/progressi');
  await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
  await expect(page).toHaveURL('/allenamento');
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
  await page.locator('.bottom-nav').getByRole('button', { name: 'Progressi', exact: true }).click();
  await page.getByRole('button', { name: 'Apri impostazioni account' }).click();
  await page.getByRole('button', { name: 'Esci dalla demo', exact: true }).click();
  await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
  await expect(page).toHaveURL('/allenamento');
  await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Allenamento', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('una conferma salva la serie, avanza e conserva timer e bozza dopo riapertura offline', async ({ page, context }) => {
  await demo(page); await startLower(page);
  await expect(page.locator('.previous-weight')).toContainText('Ultima volta');
  await expect(page.locator('.workout-page textarea')).toHaveCount(0);
  await expect(page.locator('.rest-control button, .rest-control input')).toHaveCount(0);
  await expect(page.getByRole('timer', { name: 'Tempo di esecuzione' })).toBeVisible();
  await expect(page.locator('.set-tab').first()).toHaveText('1');
  const suggestedWeight = await page.getByRole('textbox', { name: 'Peso', exact: true }).inputValue();
  const suggestedReps = await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).inputValue();
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 1, completata', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Serie 2', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.set-saved-status')).toContainText('Serie salvata');
  await expect(page.locator('.rest-control')).toContainText('Recupero in corso');
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('62,5');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue('62,5');
  await expect(page.getByRole('button', { name: 'Serie 1, completata', exact: true })).toBeVisible();
  await expect(page.locator('.rest-control')).toContainText('Recupero in corso');
  await page.getByRole('button', { name: 'Serie 1, completata', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue(suggestedWeight);
  await expect(page.getByRole('textbox', { name: 'Ripetizioni', exact: true })).toHaveValue(suggestedReps);
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('65');
  await page.getByRole('button', { name: 'Aggiorna serie', exact: true }).click();
  await expect(page.locator('.set-saved-status')).toContainText('Serie aggiornata');
  await expect(page.getByRole('button', { name: 'Serie 1, completata', exact: true })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Serie 2', exact: true }).click();
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('button', { name: /Termina allenamento/ }).click();
  await finishFeedback(page);
  await expect(page).toHaveURL(/\/storico\//);
  await expect(page.locator('.history-set-row')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.history-set-row')).toHaveCount(2);
  await expect(page.locator('.history-set-row').first()).toContainText('65');
});

test('il peso modificato segue le serie successive anche dopo riapertura, senza alterare quelle compilate', async ({ page }) => {
  await demo(page); await startLower(page);
  const weight = page.getByRole('textbox', { name: 'Peso', exact: true });
  const previous = await page.locator('.previous-weight').textContent();
  await page.getByRole('button', { name: 'Aumenta peso', exact: true }).click();
  const increased = await weight.inputValue();
  await expect(page.locator('.previous-weight')).toHaveText(previous!);
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 2', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(weight).toHaveValue(increased);
  await page.reload();
  await expect(weight).toHaveValue(increased);
  await page.getByRole('button', { name: 'Diminuisci peso', exact: true }).click();
  await page.getByRole('button', { name: 'Diminuisci peso', exact: true }).click();
  const decreased = await weight.inputValue();
  expect(decreased).not.toBe(increased);
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 3', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(weight).toHaveValue(decreased);
  await page.getByRole('button', { name: 'Serie 1, completata', exact: true }).click();
  await expect(weight).toHaveValue(increased);
  await page.getByRole('button', { name: 'Serie 2, completata', exact: true }).click();
  await expect(weight).toHaveValue(decreased);
  await page.getByRole('button', { name: 'Esercizi', exact: false }).first().click();
  await page.locator('.workout-agenda').getByRole('button', { name: /Bulgarian split squat/ }).click();
  await expect(weight).not.toHaveValue(decreased);
  await page.getByRole('button', { name: 'Esercizi', exact: false }).first().click();
  await page.locator('.workout-agenda').getByRole('button', { name: /Hip thrust/ }).click();
  await page.getByRole('button', { name: 'Serie 3', exact: true }).click();
  await expect(weight).toHaveValue(decreased);
});

test('lati diversi restano separati e lo storico corretto aggiorna i valori', async ({ page }) => {
  await demo(page); await startLower(page);
  await page.getByRole('button', { name: 'Esercizi', exact: false }).first().click();
  await page.locator('.workout-agenda').getByRole('button', { name: /Bulgarian split squat/ }).click();
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('12');
  await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Valori per lato', exact: true }).click();
  await page.getByLabel('Valori diversi per i due lati').check();
  await page.getByRole('textbox', { name: 'Peso destro', exact: true }).fill('10');
  await page.getByRole('textbox', { name: 'Ripetizioni destra', exact: true }).fill('8');
  await page.getByRole('button', { name: 'Fatto', exact: true }).click();
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('button', { name: /Termina allenamento/ }).click();
  await finishFeedback(page);
  await expect(page.locator('.session-facts')).toContainText('400');
  await expect(page.locator('.history-side-note')).toContainText('Destro: 10 kg × 8 reps');
  await page.locator('.history-set-row').click();
  await page.getByRole('textbox', { name: 'Peso storico' }).fill('14');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.locator('.session-facts')).toContainText('440');
  await page.reload();
  await expect(page.locator('.history-set-row')).toContainText('14');
  await expect(page.locator('.session-facts')).toContainText('440');
});

test('un valore incompleto non perde il modulo quando si annulla la navigazione', async ({ page }) => {
  await demo(page); await startLower(page);
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Controlla la serie' }).getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Torna alla serie' }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Lasciare la schermata?' })).toBeVisible();
  await page.getByRole('button', { name: 'Resta qui', exact: true }).click();
  await expect(page).toHaveURL('/allenamento/sessione');
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('60');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 1, completata', exact: true })).toBeVisible();
});

test('a 390 px la conferma resta visibile e l’elenco esercizi consente di tornare alla serie', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page); await startLower(page);
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  await expect(page.locator('.app-header .brand')).toHaveText('Kynlift');
  const save = page.getByRole('button', { name: 'Salva serie', exact: true });
  await expect(save).toBeInViewport({ ratio: 1 });
  const saveBox = await save.boundingBox();
  const navigationBox = await page.locator('.bottom-nav').boundingBox();
  expect(saveBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(navigationBox!.y);
  const weight = await page.getByRole('textbox', { name: 'Peso', exact: true }).inputValue();
  await page.getByRole('button', { name: 'Esercizi', exact: false }).first().click();
  await expect(page.getByRole('dialog', { name: 'Esercizi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi esercizi', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue(weight);
  await expect(save).toBeVisible();
});

test('il recupero proviene dalla scheda e una modifica successiva conserva quello della sessione attiva', async ({ page }) => {
  await demo(page); await startLower(page);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
  await page.getByLabel('Recupero, secondi', { exact: true }).fill('75');
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le tue schede', exact: true })).toBeVisible();
  await page.locator('.resume-strip').click();
  await expect(page.locator('.rest-control button, .rest-control input, .rest-control select')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.locator('.rest-control')).toContainText('Recupero in corso');
  const countdown = (await page.getByRole('timer', { name: 'Tempo di recupero' }).textContent())!.split(':').map(Number);
  expect(countdown[0] * 60 + countdown[1]).toBeGreaterThan(110);
  expect(countdown[0] * 60 + countdown[1]).toBeLessThanOrEqual(120);
});


test('pausa e timer di esecuzione persistono e la home termina la sessione con il suo avanzamento', async ({ page }) => {
  await page.clock.install();
  await demo(page); await startLower(page);
  await page.clock.fastForward(6_000);
  const workTimer = page.getByRole('timer', { name: 'Tempo di esecuzione' });
  await expect(workTimer).not.toHaveText('00:00');
  await page.getByRole('button', { name: 'Metti in pausa allenamento' }).click();
  await expect(page.locator('.rest-control')).toContainText('Allenamento in pausa');
  const frozen = await workTimer.textContent();
  await page.clock.fastForward(60_000);
  await expect(workTimer).toHaveText(frozen!);
  await expect(page.getByRole('button', { name: 'Salva serie', exact: true })).toBeDisabled();
  await page.reload();
  await expect(workTimer).toHaveText(frozen!);
  await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
  await expect(page.locator('.active-workout')).toContainText('In pausa');
  await page.getByRole('button', { name: 'Riprendi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salva serie', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('timer', { name: 'Tempo di recupero' })).toBeVisible();
  await page.clock.fastForward(125_000);
  await expect(workTimer).toBeVisible();
  await expect(workTimer).not.toHaveText('00:00');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 2, completata', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
  await expect(page.getByRole('progressbar', { name: 'Avanzamento allenamento' })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('progressbar', { name: 'Avanzamento allenamento' })).toHaveAttribute('aria-valuemax', '15');
  await page.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
  await finishFeedback(page);
  await expect(page).toHaveURL(/\/storico\//);
  await expect(page.locator('.history-set-duration')).toHaveCount(2);
  await expect(page.locator('.session-facts')).toContainText('2 min');
  await page.reload();
  await expect(page.locator('.history-set-duration')).toHaveCount(2);
});

test('RIR richiesto, opzioni avanzate accessibili e serie selezionata centrata', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'Gestisci', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Lower body A', exact: true }).click();
  await page.getByLabel('Serie', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Salva scheda', exact: true }).click();
  await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
  await startLower(page);
  await page.getByRole('textbox', { name: 'RIR', exact: true }).fill('');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Controlla la serie' }).getByRole('alert')).toContainText('RIR');
  await page.getByRole('button', { name: 'Torna alla serie' }).click();
  await expect(page.getByRole('button', { name: 'Serie 1', exact: true })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('textbox', { name: 'RIR', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Serie 8', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serie 8', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect.poll(async () => page.locator('.set-tabs').evaluate((rail) => {
    const box = rail.getBoundingClientRect();
    const selected = rail.querySelector('[aria-current="step"]')!.getBoundingClientRect();
    return Math.abs(selected.top + selected.height / 2 - box.top - box.height / 2);
  })).toBeLessThan(4);
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Opzioni avanzate' })).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi una serie', exact: true }).click();
  await expect(page.locator('.set-tab')).toHaveCount(13);
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('button', { name: 'Rimuovi l’ultima serie', exact: true }).click();
  await expect(page.locator('.set-tab')).toHaveCount(12);
});

test('i tab dei progressi condividono il periodo e filtrano riepilogo, esercizi e storico', async ({ page }) => {
  await demo(page);
  await expect(page.getByRole('heading', { name: 'Il tuo ritmo' })).toHaveCount(0);
  await expect(page.locator('.today-date, .start-panel, .recent-section')).toHaveCount(0);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Progressi', exact: true }).click();
  const period = page.getByRole('combobox', { name: 'Periodo' });
  await expect(page.getByRole('tab', { name: 'Riepilogo' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Il tuo ritmo' })).toBeVisible();
  await selectPeriod(page, 'Ultima settimana');
  await page.getByRole('tab', { name: 'Esercizi', exact: true }).click();
  await expect(period).toContainText('Ultima settimana');
  await expect(page.getByRole('tabpanel', { name: 'Esercizi' })).toBeVisible();
  await selectPeriod(page, 'Sempre');
  await page.getByRole('tab', { name: 'Storico' }).click();
  await expect(period).toContainText('Sempre');
  const all = await page.getByRole('button', { name: /^Apri .* del / }).count();
  await selectPeriod(page, 'Ultima settimana');
  await expect.poll(async () => page.getByRole('button', { name: /^Apri .* del / }).count()).toBeLessThan(all);
  await page.getByRole('tab', { name: 'Storico' }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Riepilogo' })).toBeFocused();
  await expect(period).toContainText('Ultima settimana');
});


test('riprende dalla barra e conserva la durata correggendo l’ultima serie senza cambiare schermata', async ({ page }) => {
  await page.clock.install();
  await demo(page); await startLower(page);
  await page.getByRole('button', { name: 'Metti in pausa allenamento' }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede', exact: true }).click();
  await page.locator('.resume-strip').click();
  await expect(page.getByRole('button', { name: 'Salva serie', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: /^Esercizi/ }).click();
  await page.locator('.workout-agenda li button').last().click();
  await page.locator('.set-tab').last().click();
  await page.clock.fastForward(8_000);
  await page.getByRole('textbox', { name: 'RIR', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aggiorna serie', exact: true })).toBeVisible();
  const storedDuration = async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('kinlift-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const docs = await new Promise<Array<{ collection: string; value: { status?: string; id: string; sessionId?: string; durationMs?: number | null } }>>((resolve, reject) => { const request = db.transaction('documents').objectStore('documents').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    const active = docs.find((row) => row.collection === 'sessions' && row.value.status === 'active')!.value;
    return docs.find((row) => row.collection === 'sets' && row.value.sessionId === active.id)!.value.durationMs;
  });
  const duration = await storedDuration();
  expect(duration).toBeGreaterThanOrEqual(8_000);
  await page.getByRole('textbox', { name: 'Ripetizioni', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Aggiorna serie', exact: true }).click();
  await expect(page.locator('.set-saved-status')).toContainText('Serie aggiornata');
  expect(await storedDuration()).toBe(duration);
});


test('raccoglie energia, sonno e note alla fine e ricalcola le statistiche dopo la modifica nello storico', async ({ page }) => {
  await demo(page); await startLower(page);
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('button', { name: /Termina allenamento/ }).click();
  const finish = page.getByRole('dialog', { name: 'Termina allenamento', exact: true });
  const sleep = finish.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true });
  await expect(sleep).toHaveValue('7');
  await finish.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
  await expect(finish.getByRole('alert')).toContainText('come ti sentivi');
  await expect(page).toHaveURL('/allenamento/sessione');
  await finish.getByRole('radio', { name: 'Alta', exact: true }).check();
  await finish.getByRole('button', { name: 'Aumenta ore di sonno', exact: true }).click();
  await expect(sleep).toHaveValue('7,5');
  await finish.getByRole('textbox', { name: /Note aggiuntive/ }).fill('Buona energia durante le serie.');
  await finish.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
  await expect(page).toHaveURL(/\/storico\//);
  await expect(page.locator('.history-feedback')).toContainText('Alta');
  await expect(page.locator('.history-feedback')).toContainText('7,5 ore');
  await expect(page.locator('.history-feedback')).toContainText('Buona energia durante le serie.');
  const historyUrl = page.url();
  await page.reload();
  await expect(page.locator('.history-feedback')).toContainText('7,5 ore');
  await page.locator('.history-feedback').getByRole('button', { name: 'Modifica', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Come è andata?', exact: true });
  await expect(edit.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true })).toHaveValue('7,5');
  await edit.locator('input[type="radio"][value="2"]').check();
  for (let step = 0; step < 3; step++) await edit.getByRole('button', { name: 'Diminuisci ore di sonno', exact: true }).click();
  await expect(edit.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true })).toHaveValue('6');
  await edit.getByRole('textbox', { name: /Note aggiuntive/ }).fill('Energia bassa nella seconda metà.');
  await edit.getByRole('button', { name: 'Salva modifiche', exact: true }).click();
  await expect(page.locator('.history-feedback')).toContainText('Bassa');
  await expect(page.locator('.history-feedback')).toContainText('6 ore');
  await page.getByRole('button', { name: 'Torna ai progressi', exact: true }).click();
  await selectPeriod(page, 'Sempre');
  await expect(page.locator('.progress-feedback')).toContainText('2');
  await expect(page.locator('.progress-feedback')).toContainText('6');
  await page.goto(historyUrl);
  await expect(page.locator('.history-feedback')).toContainText('Energia bassa nella seconda metà.');
  await page.locator('.history-feedback').getByRole('button', { name: 'Modifica', exact: true }).click();
  await edit.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true }).fill('0');
  await expect(edit.getByRole('button', { name: 'Diminuisci ore di sonno', exact: true })).toBeDisabled();
  await edit.getByRole('button', { name: 'Salva modifiche', exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(page.locator('.history-feedback')).toContainText('0 ore');
  await page.reload();
  await page.locator('.history-feedback').getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(edit.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true })).toHaveValue('0');
});

test('selettori custom gestiscono tastiera e il calendario copre ogni giorno del periodo', async ({ page }) => {
  await demo(page);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Progressi', exact: true }).click();
  const period = page.getByRole('combobox', { name: 'Periodo', exact: true });
  await expect(page.locator('.progress-page select')).toHaveCount(0);
  await expect(page.locator('.progress-training-day')).toHaveCount(30);
  await period.focus();
  await page.keyboard.press('Home');
  await expect(period).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(period).toContainText('Ultima settimana');
  await expect(page.locator('.progress-training-day')).toHaveCount(7);
  await period.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Escape');
  await expect(period).toHaveAttribute('aria-expanded', 'false');
  await expect(period).toContainText('Ultima settimana');
  await selectPeriod(page, 'Ultimi 3 mesi');
  await expect(page.locator('.progress-training-day')).toHaveCount(90);
  await selectPeriod(page, 'Sempre');
  expect(await page.locator('.progress-training-day').count()).toBeGreaterThan(30);
  await page.getByRole('tab', { name: 'Esercizi', exact: true }).click();
  const exercise = page.getByRole('combobox', { name: 'Esercizio', exact: true });
  await exercise.click();
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await expect(exercise).toContainText(/Back squat|Bulgarian/);
});

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`allenamento fisso a ${viewport.width}×${viewport.height} con dialog coerenti`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await demo(page); await startLower(page);
    await page.evaluate(async () => { await document.fonts.ready; });
    await expect(page.locator('.exercise-toggle svg')).toHaveClass(/lucide-dumbbell/);
    await expect(page.locator('.advanced-toggle svg')).toHaveClass(/lucide-settings/);
    await expect(page.locator('.previous-weight svg, .load-convention')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    const save = page.getByRole('button', { name: 'Salva serie', exact: true });
    await expect(save).toBeInViewport({ ratio: 1 });
    const before = await save.boundingBox();
    await page.mouse.wheel(0, 800);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
    expect((await save.boundingBox())!.y).toBe(before!.y);
    await page.getByRole('button', { name: /^Esercizi/ }).click();
    await expect(page.getByRole('dialog', { name: 'Esercizi', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Esercizi/ })).toBeFocused();
    await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
    await page.getByRole('button', { name: 'Annulla allenamento', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Riprendi', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Opzioni avanzate' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Esercizi/ }).click();
    await page.getByRole('dialog', { name: 'Esercizi', exact: true }).getByRole('button', { name: /Bulgarian split squat/ }).click();
    const next = await page.getByRole('button', { name: 'Successivo', exact: true }).boundingBox();
    const bottom = viewport.width <= 700 ? (await page.locator('.bottom-nav').boundingBox())!.y : viewport.height;
    expect(next!.y + next!.height).toBeLessThanOrEqual(bottom);
    await expect(save).toBeInViewport({ ratio: 1 });
  });
}

test('la conferma custom conserva schermata e URL anche con Indietro ripetuto', async ({ page }) => {
  await demo(page); await startLower(page);
  const previousWeight = await page.getByRole('textbox', { name: 'Peso', exact: true }).inputValue();
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('');
  await page.evaluate(() => history.back());
  const confirm = page.getByRole('alertdialog', { name: 'Lasciare la schermata?' });
  await expect(confirm).toBeVisible();
  await expect(page).toHaveURL('/allenamento/sessione');
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL('/allenamento/sessione');
  await confirm.getByRole('button', { name: 'Resta qui', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue('');
  await page.evaluate(() => history.back());
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Lascia schermata', exact: true }).click();
  await expect(page).toHaveURL('/allenamento');
  await expect(page.locator('.active-workout')).toBeVisible();
  await page.getByRole('button', { name: 'Riprendi', exact: true }).click();
  await expect(page).toHaveURL('/allenamento/sessione');
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue(previousWeight);
});

test('la fine dalla home conserva energia e sonno quando si annulla Indietro', async ({ page }) => {
  await demo(page); await startLower(page);
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await page.getByRole('button', { name: 'Kynlift, vai all’allenamento' }).click();
  await expect(page.locator('.active-workout')).toContainText('Esercizio da riprendere');
  await page.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Termina allenamento', exact: true });
  await finish.getByRole('radio', { name: 'Alta', exact: true }).check();
  await finish.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true }).fill('8');
  await page.evaluate(() => history.back());
  await page.getByRole('alertdialog').getByRole('button', { name: 'Resta qui' }).click();
  await expect(finish).toBeVisible();
  await expect(finish.getByRole('radio', { name: 'Alta', exact: true })).toBeChecked();
  await expect(finish.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true })).toHaveValue('8');
  await finish.getByRole('button', { name: 'Termina allenamento', exact: true }).click();
  await expect(page).toHaveURL(/\/storico\//);
  await expect(page.locator('.history-feedback')).toContainText('8 ore');
});

test('con viewport ridotta i campi restano raggiungibili e i dialog si adattano', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page); await startLower(page);
  await page.setViewportSize({ width: 390, height: 500 });
  for (const name of ['Peso', 'Ripetizioni', 'RIR']) {
    const field = page.getByRole('textbox', { name, exact: true });
    await field.focus();
    await expect(field).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Salva serie', exact: true })).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('button', { name: 'Salva serie', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Serie 1, completata', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Opzioni avanzate', exact: true }).click();
  await page.getByRole('button', { name: /Termina allenamento/ }).click();
  await page.setViewportSize({ width: 390, height: 400 });
  const finish = page.getByRole('dialog', { name: 'Termina allenamento', exact: true });
  const sleep = finish.getByRole('textbox', { name: 'Ore di sonno prima dell’allenamento', exact: true });
  await sleep.focus();
  await expect(sleep).toBeInViewport({ ratio: 1 });
  await sleep.fill('7');
  const note = finish.getByRole('textbox', { name: /Note aggiuntive/ });
  await note.focus();
  await expect(note).toBeInViewport({ ratio: 1 });
  await note.fill('Prova con tastiera');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});
