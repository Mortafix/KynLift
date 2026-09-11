# Controlli automatici

Il workflow [CI](../.github/workflows/ci.yml) parte su push, pull request e avvio manuale da GitHub Actions. Esegue solo verifiche: non pubblica il sito, non distribuisce regole e non richiede credenziali Firebase. I nuovi commit annullano i controlli obsoleti della stessa pull request o branch.

## Cosa verifica

- **Web, SEO e dipendenze**: installazione con lockfile congelato, test unitari, build, `npm run check:dist`, test Playwright su Chromium e audit delle dipendenze di produzione con soglia `moderate`. L’audit viene eseguito anche se un controllo precedente fallisce, purché l’installazione sia riuscita.
- **Firebase Auth e regole Firestore**: un job indipendente avvia gli emulatori Auth/Firestore sul progetto locale `demo-kinlift` ed esegue le relative suite con Java 21. Non accede a un progetto remoto.

La build CI usa `VITE_SITE_INDEXING=false` e configurazione Firebase vuota. L’artefatto `dist-demo`, conservato per 7 giorni solo dopo il successo dei controlli web, serve per ispezionare la build di prova. La pubblicazione richiede una nuova build con la configurazione di produzione descritta nella [guida al deploy](DEPLOYMENT.md).

Se un test browser fallisce, scarica `playwright-failure`: contiene le trace in `test-results/`, grazie a `trace: 'retain-on-failure'` già presente in `playwright.config.ts`. Puoi aprire una trace con `pnpm exec playwright show-trace percorso/trace.zip`. I fallimenti degli emulatori conservano i log disponibili nell’artefatto `firebase-emulator-failure`. Entrambi scadono dopo 7 giorni.

## Runtime e manutenzione

La CI usa **Node 24 LTS** su Ubuntu 24.04, una linea LTS verificata nell’[elenco ufficiale delle release Node.js](https://nodejs.org/en/about/previous-releases). La versione pnpm viene letta dal campo `packageManager` di `package.json`. [`pnpm/setup@v2`](https://github.com/pnpm/setup) installa pnpm 11+ come eseguibile autonomo e il runtime richiesto; il workflow esegue poi esplicitamente `pnpm install --frozen-lockfile`.

Playwright viene eseguito dal progetto installato: `pnpm exec playwright install --with-deps chromium` scarica il browser associato alla versione nel lockfile (1.63.0 al momento della preparazione). Non usa una versione scaricata separatamente del test runner. Il comando di installazione segue la [documentazione CI di Playwright](https://playwright.dev/docs/ci-intro).

Le altre action usano le release principali pubblicate dai rispettivi progetti: [`actions/checkout@v7`](https://github.com/actions/checkout), [`actions/setup-java@v6`](https://github.com/actions/setup-java), [`actions/upload-artifact@v7`](https://github.com/actions/upload-artifact). Il token del workflow ha soltanto `contents: read` e il checkout non conserva credenziali Git. Dopo un aggiornamento del lockfile o delle action, attendi il risultato di entrambi i job prima della pubblicazione. L’audit usa le [opzioni ufficiali di pnpm](https://pnpm.io/cli/audit) e non ignora errori del registry o vulnerabilità senza correzione.

La sintassi YAML è stata validata localmente e le opzioni delle action controllate sui riferimenti ufficiali. Il workflow non è stato eseguito su GitHub: il primo risultato effettivo sarà disponibile dopo il push del repository. Non sostituisce la verifica del dominio, degli header e dei flussi Google/account sul server di produzione.

Il job web verifica anche la configurazione Nginx su HTTPS locale contro la build prodotta (`deploy/verify-nginx.py`), con helper Firebase simulati. Non contatta il server di produzione.
