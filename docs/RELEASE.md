# Kynlift — preparazione al rilascio

Dominio pubblico: **https://kinlift.moris.dev**. Il marchio resta **Kynlift**: il dominio contiene `kinlift`, come nella configurazione già fornita. Data della preparazione: 11 settembre 2026. Non è stato eseguito alcun deploy.

## Cosa viene prodotto

- `index.html`: pagina pubblica prerenderizzata dalla stessa pagina di accesso React, titolo e descrizione, canonical assoluto, Open Graph, Twitter card, JSON-LD `WebSite`. Nessuna recensione, prezzo o valutazione inventata.
- `app.html`: shell delle schermate personali con `noindex, nofollow`, senza canonical né schema pubblico. I titoli cambiano durante navigazione, indietro e ricaricamento; non incorporano nomi o dati degli allenamenti.
- `robots.txt` e `sitemap.xml`: generati dalla build. In produzione la sitemap contiene solo `/`. Le rotte personali restano scansionabili per consentire ai motori di leggere il `noindex`; il proxy Firebase è escluso dalla scansione.
- `social-card.png`: anteprima 1200×630 con marchio, colori e font esistenti. Per rigenerarla: `npm run social:generate` dopo l’installazione di Chromium per Playwright.
- `404.html`: pagina statica con ritorno alla home, senza JavaScript necessario. Nginx restituisce un vero 404 per URL sconosciuti e asset mancanti.
- PWA: manifest, icone, font locali e precache coerente con l’HTML finale; fallback offline limitato alle rotte dell’app, esclusi helper Auth/Firebase e URL sconosciuti.

I metadati sono definiti in `site.config.json`. Modifica quello per cambiare dominio e descrizioni, poi aggiorna dominio Firebase, proxy, OAuth e card e ricrea la build. L’app si pubblica alla radice del dominio.

## Eseguire i controlli

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm release:check
pnpm audit --prod --audit-level moderate
```

`release:check` esegue unit test, emulatori, preflight della configurazione, TypeScript/build, verifica degli artefatti e test browser. Serve **Java 21+** per gli emulatori; i test usano `demo-kinlift`, senza scritture sul progetto Firebase reale. Ogni comando interrompe la catena se fallisce.

Controlli singoli:

```sh
npm run preflight
npm run build:production
npm run check:dist
npm run test:e2e
```

Su questa macchina Corepack con Node 26 non avvia correttamente pnpm 11. Puoi usare gli script `npm run …` con le dipendenze già installate. Per eseguire pnpm qui è stato verificato il binario diretto:

```sh
node /Users/moris/.cache/node/corepack/pnpm/11.19.0/bin/pnpm.cjs --version
```

Per un ambiente riproducibile usa Node 24 LTS e pnpm dalla versione `packageManager`, come nella [CI](CI.md). La CI produce una build demo con indicizzazione disattivata: **non usare l’artefatto `dist-demo` come release pubblica**.

## Configurazione e protezione dei dati

Le variabili Firebase del client sono identificativi pubblici; `.env.local` resta ignorato da Git. Il preflight rifiuta variabili `VITE_*` non previste e materiale riconoscibile come chiave privata. Non è una verifica delle impostazioni remote: controlla nella console i provider abilitati, gli account distinti per provider, il dominio autorizzato e l’URI OAuth.

Il template Nginx applica HTTPS/HSTS sul solo host, `nosniff`, Referrer Policy, Permissions Policy e una CSP compatibile con Auth. HTML, worker e manifest sono rivalidabili; gli asset con hash esistenti hanno cache lunga, mentre 404 e risposte Auth non vengono memorizzati. Il proxy verifica il certificato dell’upstream Firebase.

Non sono stati introdotti analytics, tracker o cookie pubblicitari. `noindex` è una direttiva di indicizzazione: l’accesso ai dati continua a dipendere da Authentication e regole Firestore, testate separatamente.

## Prima di caricare la release

1. Completa la [revisione privacy](PRIVACY.md): la [bozza con titolare e contatto](PRIVACY-DRAFT.md) è pronta, ma restano le decisioni su basi giuridiche, energia/sonno, conservazione e cancellazione e infrastruttura. La bozza è esclusa dalla build pubblica.
2. Pubblica le regole Firestore aggiornate prima del frontend: i campi energia/sonno/durata devono essere accettati. Non ripristinare regole incompatibili con dati già salvati.
3. Esegui `release:check` con configurazione produzione. `VITE_SITE_INDEXING=true` è richiesto; demo/staging devono usare `false`.
4. Integra e verifica il [template Nginx](../deploy/kinlift.moris.dev.conf.example). Il test locale riproducibile è descritto nella [guida deploy](../deploy/README.md).
5. Carica l’intero `dist/` in una nuova release; conserva release e asset precedenti e cambia il riferimento `current` in modo atomico. Configurazioni Nginx ed environment non si caricano nel document root.

## Dopo la pubblicazione

```sh
npm run check:live
```

È un controllo HTTP in sola lettura su HTTPS, home, SEO, manifest, worker, 404, cache, header e helper Firebase. Non effettua login e non modifica dati. La pubblicazione non viene eseguita da questo comando.

Completa sul dominio reale accesso email, Google e collegamento dei provider, isolamento fra due account, sincronizzazione offline/online e aggiornamento PWA su Safari/iPhone e Chrome/Android. I test locali non verificano certificati del server di destinazione, impostazioni OAuth remote o comportamento dei telefoni reali.

In Google Search Console verifica la proprietà del dominio tramite DNS, invia `https://kinlift.moris.dev/sitemap.xml` e controlla `/` con Ispezione URL. Queste operazioni richiedono l’account del proprietario; non sono state effettuate. Dopo traffico reale, controlla indicizzazione e Core Web Vitals: non sono deducibili dai test locali né garantiti dai metadati.

## Fonti tecniche

- [Google: SEO JavaScript e prerender](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- [Google: esclusione tramite noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google: creazione e invio delle sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [Firebase: reverse proxy per accesso via redirect](https://firebase.google.com/docs/auth/web/redirect-best-practices#option-3-proxy-auth-requests-to-firebaseappcom).

## Elementi da tenere sotto controllo

L’audit effettuato sulle dipendenze distribuite al browser non ha rilevato vulnerabilità. L’audit completo ha rilevato sei advisory moderate nelle dipendenze transitive di Firebase CLI, senza high/critical. Sono strumenti locali/CI e non fanno parte di `dist/`; vanno aggiornati quando Firebase CLI offre risoluzioni compatibili, evitando override major non verificati.

I metadati ausiliari Impeccable risultano precedenti a `DESIGN.md` e senza preferenza `buildPath`. Non impediscono build o deploy e non sono stati modificati: un futuro aggiornamento della documentazione del design può riallinearli.
