import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

function profileForm(page: Page) {
  return page.getByRole('form', { name: 'Modifica profilo', exact: true });
}

function profilePhoto(page: Page) {
  return profileForm(page).getByRole('button', { name: 'Apri foto del profilo', exact: true }).locator('img');
}

async function openPhoto(page: Page) {
  await profileForm(page).getByRole('button', { name: 'Apri foto del profilo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Foto del profilo', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function choosePhoto(page: Page) {
  const dialog = await openPhoto(page);
  await dialog.getByLabel('Scegli foto del profilo', { exact: true }).setInputFiles('public/icons/icon-192.png');
  await expect(dialog).toHaveCount(0);
}

async function removePhoto(page: Page) {
  const dialog = await openPhoto(page);
  await expect(dialog.getByRole('img', { name: 'Anteprima foto del profilo', exact: true }).locator('img')).toBeVisible();
  await dialog.getByRole('button', { name: 'Rimuovi', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function openProfile(page: Page) {
  await page.getByRole('button', { name: 'Apri impostazioni account', exact: true }).click();
  await expect(profileForm(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo', exact: true }).click();
  await openProfile(page);
});

test('mostra l’anteprima e conserva nome e foto salvati alla riapertura, inclusa la rimozione', async ({ page }) => {
  const form = profileForm(page);
  const headerPhoto = page.getByRole('button', { name: 'Apri impostazioni account', exact: true }).locator('img');
  await expect(form.getByRole('button', { name: 'Salva profilo', exact: true })).toHaveCount(0);
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Modifica nome', exact: true })).toHaveText('');
  await expect(form.getByRole('button', { name: /Cambia|Rimuovi/ })).toHaveCount(0);
  const emptyPhoto = await openPhoto(page);
  await expect(emptyPhoto.getByRole('button', { name: 'Rimuovi', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(form.getByRole('button', { name: 'Apri foto del profilo', exact: true })).toBeFocused();
  await form.getByRole('button', { name: 'Modifica nome', exact: true }).click();
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toBeFocused();
  await form.getByLabel('Il tuo nome', { exact: true }).fill('  Giulia Bianchi  ');
  await choosePhoto(page);
  await expect(profilePhoto(page)).toBeVisible();
  await expect(headerPhoto).toHaveCount(0);
  const preview = await profilePhoto(page).getAttribute('src');
  expect(preview).toMatch(/^data:image\/jpeg;base64,/);
  expect(preview!.length).toBeLessThanOrEqual(180_000);
  await expect.poll(() => profilePhoto(page).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const dimensions = await profilePhoto(page).evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }));
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.width).toBe(dimensions.height);
  expect(dimensions.width).toBeLessThanOrEqual(384);
  await form.getByRole('button', { name: 'Salva profilo', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('Profilo aggiornato.');
  await expect(headerPhoto).toHaveAttribute('src', preview!);
  await expect(form.locator('.profile-name strong')).toHaveText('Giulia Bianchi');
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(form.locator('.profile-name strong')).toHaveText('Giulia Bianchi');
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toHaveCount(0);
  await expect(profilePhoto(page)).toHaveAttribute('src', preview!);
  await expect(headerPhoto).toHaveAttribute('src', preview!);
  await removePhoto(page);
  await expect(profilePhoto(page)).toHaveCount(0);
  await expect(headerPhoto).toHaveAttribute('src', preview!);
  await form.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(profilePhoto(page)).toHaveAttribute('src', preview!);
  await removePhoto(page);
  await form.getByRole('button', { name: 'Salva profilo', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('Profilo aggiornato.');
  await page.reload();
  await expect(form.locator('.profile-name strong')).toHaveText('Giulia Bianchi');
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toHaveCount(0);
  await expect(profilePhoto(page)).toHaveCount(0);
  await expect(headerPhoto).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apri impostazioni account', exact: true })).toHaveText('G');
});

test('annulla la bozza e protegge le modifiche quando si cambia pagina', async ({ page }) => {
  const form = profileForm(page);
  const name = form.getByLabel('Il tuo nome', { exact: true });
  const originalName = (await form.locator('.profile-name strong').textContent())!;
  await form.getByRole('button', { name: 'Modifica nome', exact: true }).click();
  await name.fill('Nome provvisorio');
  await choosePhoto(page);
  await expect(profilePhoto(page)).toBeVisible();
  await form.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(form.locator('.profile-name strong')).toHaveText(originalName);
  await expect(name).toHaveCount(0);
  await expect(profilePhoto(page)).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Salva profilo', exact: true })).toHaveCount(0);

  await form.getByRole('button', { name: 'Modifica nome', exact: true }).click();
  await name.fill('Nome da proteggere');
  const routines = page.getByRole('navigation', { name: 'Navigazione principale mobile', exact: true }).getByRole('button', { name: 'Schede', exact: true });
  await routines.click();
  const confirmation = page.getByRole('alertdialog', { name: 'Lasciare la schermata?', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Resta qui', exact: true }).click();
  await expect(page).toHaveURL(/\/impostazioni$/);
  await expect(name).toHaveValue('Nome da proteggere');
  await routines.click();
  await confirmation.getByRole('button', { name: 'Lascia schermata', exact: true }).click();
  await expect(page).toHaveURL(/\/schede$/);
  await openProfile(page);
  await expect(form.locator('.profile-name strong')).toHaveText(originalName);
  await expect(name).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Salva profilo', exact: true })).toHaveCount(0);
});

test('rifiuta file non validi conservando il nome e l’ultima foto in bozza', async ({ page }) => {
  const form = profileForm(page);
  await form.getByRole('button', { name: 'Modifica nome', exact: true }).click();
  await form.getByLabel('Il tuo nome', { exact: true }).fill('Bozza conservata');
  await choosePhoto(page);
  await expect(profilePhoto(page)).toBeVisible();
  const preview = await profilePhoto(page).getAttribute('src');
  const dialog = await openPhoto(page);
  const upload = dialog.getByLabel('Scegli foto del profilo', { exact: true });
  await upload.setInputFiles({ name: 'appunti.txt', mimeType: 'text/plain', buffer: Buffer.from('Non è una foto.') });
  await expect(dialog.getByRole('alert')).toContainText('Scegli una foto');
  await expect(page.locator('.app-messages [role=alert]')).toHaveCount(0);
  await expect(dialog.locator('.profile-photo-preview img')).toHaveAttribute('src', preview!);
  await upload.setInputFiles({ name: 'danneggiata.png', mimeType: 'image/png', buffer: Buffer.from('Contenuto non decodificabile') });
  await expect(dialog.getByRole('alert')).toContainText('La foto non si apre');
  await dialog.getByRole('button', { name: 'Chiudi foto del profilo', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Apri foto del profilo', exact: true })).toBeFocused();
  await expect(form.getByRole('alert')).toHaveCount(0);
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toHaveValue('Bozza conservata');
  await expect(profilePhoto(page)).toHaveAttribute('src', preview!);
  await form.getByRole('button', { name: 'Salva profilo', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('Profilo aggiornato.');
  await page.reload();
  await expect(form.locator('.profile-name strong')).toHaveText('Bozza conservata');
  await expect(form.getByLabel('Il tuo nome', { exact: true })).toHaveCount(0);
  await expect(profilePhoto(page)).toHaveAttribute('src', preview!);
});


test('un errore di salvataggio resta nel profilo e non segue la navigazione', async ({ page }) => {
  // Inject an encoder failure so the real auth profile validator rejects the save.
  // No real account or remote request is needed to exercise the error boundary.
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,invalid!';
  });
  await choosePhoto(page);
  const form = profileForm(page);
  await form.getByRole('button', { name: 'Salva profilo', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('La foto non è valida');
  await expect(page.locator('.app-messages [role="alert"]')).toHaveCount(0);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Schede', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Lascia schermata', exact: true }).click();
  await expect(page).toHaveURL(/\/schede$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await openProfile(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
