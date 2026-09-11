# Pubblicare Kynlift sul proprio server

Kynlift produce un frontend statico nella cartella `dist/`. Il server deve fornire HTTPS, fallback alla SPA e il proxy per Firebase Authentication. Non richiede un processo Node in produzione. Questa guida descrive le operazioni che il proprietario deve effettuare; non documenta una pubblicazione già eseguita.

## 1. Prepara Firebase

1. Crea un progetto Firebase e registra un’app web.
2. Abilita **Authentication → Email/Password** e **Google**; completa i dati richiesti dal provider.
   In **Authentication → Settings → User account linking**, seleziona **Create multiple accounts for each identity provider** (`oneAccountPerEmail=false`, equivalente a `signIn.allowDuplicateEmails=true`). Questa impostazione è necessaria: con il comportamento predefinito Firebase può collegare automaticamente un account Google autorevole a una email/password non verificata e sostituirne il metodo di accesso. Kynlift richiede invece un collegamento esplicito dalle impostazioni. [Comportamento Firebase delle email verificate](https://firebase.google.com/docs/auth/users#verified_email_addresses).
3. Crea il database **Cloud Firestore** e scegli la regione adatta al gruppo di utenti. Usa il database predefinito.
4. Pubblica le regole presenti in `firestore.rules`. Non lasciare regole di test aperte: il codice legge e scrive solo sotto l’UID dell’account autenticato.
5. Configura il dominio HTTPS definitivo come descritto nella sezione successiva.

Puoi pubblicare regole e indici dalla console o, dal repository, con la Firebase CLI autenticata sul tuo progetto:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes --project IL_TUO_PROJECT_ID
```

Questo comando modifica le regole del progetto indicato. Il frontend rimane sul tuo server; non viene pubblicato su Firebase Hosting.

Le quote gratuite Firestore comprendono attualmente 1 GiB di dati, 50.000 letture e 20.000 scritture al giorno per il database gratuito del progetto. Sono un punto di partenza plausibile per un piccolo gruppo, non una garanzia di costo nullo: controlla utilizzo e riconnessioni nella console. Il server e il dominio hanno costi separati. Quote verificate il 10 settembre 2026 nella [documentazione Firebase](https://firebase.google.com/docs/firestore/quotas).

## 2. Configura dominio e Google

Esempi da sostituire: dominio `kynlift.example.com`, progetto `IL_TUO_PROJECT_ID`.

- In Firebase Authentication aggiungi `kynlift.example.com` ai domini autorizzati.
- Nel client OAuth web del provider Google autorizza `https://kynlift.example.com/__/auth/handler` come URI di reindirizzamento.
- Imposta `VITE_FIREBASE_AUTH_DOMAIN=kynlift.example.com`, senza protocollo o percorso.
- Il server inoltra GET/POST di `/__/auth/` a `https://IL_TUO_PROJECT_ID.firebaseapp.com/__/auth/`, mantenendo trasparente il proxy. Non usare un redirect HTTP o il fallback della SPA.

Il dominio dell’app e quello degli helper di accesso coincidono dal punto di vista del browser. È l’approccio con reverse proxy documentato da Firebase per gli accessi via redirect con storage di terze parti bloccato. [Fonte ufficiale](https://firebase.google.com/docs/auth/web/redirect-best-practices#option-3-proxy-auth-requests-to-firebaseappcom).

Il controllo nel codice richiede che `authDomain` coincida con l’host corrente. Per verificare Google usa il dominio HTTPS configurato; la demo locale funziona senza questo servizio.

Dopo aver configurato gli account distinti per provider, imposta `VITE_FIREBASE_EXPLICIT_LINKING=true`. Finché questa conferma manca, Kynlift blocca l’avvio di Google. È una conferma della configurazione da parte del gestore, non una verifica remota della console. Con questa policy, usare Google dalla pagina di accesso dopo essersi registrati con password può creare un account separato: per conservare lo stesso UID e storico, accedi prima con la password e usa **Collega Google** nelle impostazioni. Se due account esistono già, l’app segnala il conflitto e non li unisce.

## 3. Crea la build

Il dominio canonico è definito in `site.config.json` (attualmente `https://kinlift.moris.dev`). `VITE_SITE_INDEXING=true` abilita home e sitemap pubbliche; lascia `false` per demo e staging. Il comando `build:production` blocca configurazioni incomplete, dominio Auth incoerente, indicizzazione disattivata e variabili pubbliche inattese.

Copia `.env.example` in `.env.local` e inserisci i valori dell’app web:

```dotenv
VITE_FIREBASE_API_KEY=VALORE_DALLA_CONSOLE
VITE_FIREBASE_PROJECT_ID=IL_TUO_PROJECT_ID
VITE_FIREBASE_APP_ID=VALORE_DALLA_CONSOLE
VITE_FIREBASE_AUTH_DOMAIN=kynlift.example.com
VITE_FIREBASE_EXPLICIT_LINKING=true
VITE_SITE_INDEXING=true
```

Le variabili `VITE_*` vengono incluse nel JavaScript pubblico durante la build. Sono la configurazione dell’app web: non inserire credenziali Admin SDK, chiavi private o service account. L’autorizzazione ai dati è affidata ad Authentication e alle regole Firestore.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build:production
```

Carica **il contenuto completo di `dist/`** nella directory servita dal dominio. I valori `.env` sono incorporati: ogni modifica alla configurazione richiede una nuova build. Il progetto assume pubblicazione alla radice `/`, non in una sottocartella.

## 4. Configura Nginx

Usa il [template Nginx verificato](../deploy/kinlift.moris.dev.conf.example) e la [procedura di prima pubblicazione](../deploy/README.md). Questo è l’esempio mantenuto: contiene proxy Firebase, HTTPS, header di sicurezza, cache differenziata, `noindex` sulle pagine personali e risposte 404 reali.

La home usa `index.html`, le rotte personali conosciute usano `app.html` e gli URL inesistenti usano `404.html` con status 404. Il service worker usa la stessa shell personale per le rotte offline consentite. Non sostituire queste regole con un fallback globale a `index.html`: renderebbe indicizzabili duplicati della pagina pubblica e maschererebbe gli asset mancanti.

## 5. Verifica sul dominio reale

Controlla questi scenari su Safari/iPhone e Chrome/Android, anche dopo l’installazione della PWA:

| Scenario | Risultato atteso |
| --- | --- |
| Registrazione email e nuovo accesso | Il profilo ritrova il catalogo; nessuno storico demo appare nell’account reale. |
| Accesso Google e ritorno dal redirect | L’app recupera la sessione sul dominio configurato. |
| Collegamento Google/password | L’UID e lo storico rimangono gli stessi; account distinti non vengono fusi automaticamente. |
| Nome e foto profilo | L’accesso Google mostra la foto disponibile; nome e foto modificati nel profilo restano dopo riapertura, nuovo accesso Google e accesso da un secondo dispositivo. |
| Cambio account sullo stesso telefono | Nessun dato dell’account precedente compare nel nuovo profilo. |
| Modalità aereo dopo accesso e caricamento | Schede e storico già disponibili restano consultabili; le modifiche vengono salvate localmente. |
| Chiusura e riapertura offline | L’allenamento e le serie salvate sono recuperabili. |
| Riconnessione | Le modifiche passano da in attesa a confermate dal server, senza duplicare le serie. |
| Secondo dispositivo dopo sincronizzazione | Compaiono schede e allenamenti del profilo. Usare un solo dispositivo alla volta per una sessione. |
| Timer e schermo bloccato | Al ritorno il tempo è coerente con la scadenza; non si pretende un suono in background. |
| Allenamento e tastiera | La pagina della serie resta fissa; campi e azioni rimangono utilizzabili. Esercizi, opzioni e valori per lato si aprono in dialog con contenuti scorrevoli. |
| Conclusione offline e riapertura | Energia, ore di sonno e note vengono conservate insieme alla sessione conclusa; al ritorno online la coda si sincronizza. |
| Correzione dallo storico | Modificare energia, sonno o note aggiorna le medie del periodo senza cambiare durata, snapshot o risultati delle serie. |
| Vecchi allenamenti | I record privi di energia e sonno restano consultabili e non entrano nelle relative medie; non vengono trasformati in valori zero. |
| Periodo nei progressi | Select personalizzati utilizzabili con tocco e tastiera; il calendario include tutti i giorni del periodo e Sempre consente di cambiare anno quando necessario. |
| Aggiornamento con allenamento aperto | È possibile rinviare la nuova versione e continuare a registrare. |

Per verificare davvero lo storage locale, usa il profilo normale del browser e la build di produzione. La modalità privata e la cancellazione dei dati del sito hanno un ciclo di conservazione diverso.

I test delle regole sono separati dai normali test unitari e richiedono l’emulatore:

```sh
pnpm test:emulators
```

Verificano l’isolamento degli account, il rifiuto delle scritture non autorizzate e la validazione dei campi di durata, energia e sonno, mantenendo accettabili i record precedenti. Non sostituiscono la prova di accesso OAuth con il tuo dominio reale.

`npm run test:auth` verifica la policy di collegamento con l’emulatore Auth: il test riproduce il comportamento automatico predefinito e controlla che gli account separati preservino la password. `npm run test:emulators` esegue entrambe le suite. Gli emulatori usano il progetto locale `demo-kinlift` e non richiedono credenziali del progetto reale.

### Come vengono risolti gli aggiornamenti

Il salvataggio confermato nell’app corrisponde a una transazione IndexedDB completata. Le modifiche mantengono una revisione in coda fino a conferma e rilettura dal server. I documenti Firestore contengono un campo interno `_sync`: il timestamp viene assegnato dal server, mentre client e sequenza impediscono che una vecchia richiesta di un’altra scheda del browser riscriva una revisione più recente.

Tra dispositivi diversi prevale l’ultima scrittura confermata dal server, indipendentemente dall’orologio del telefono. Una modifica ancora in coda sul dispositivo resta protetta fino al proprio invio. Usare un solo dispositivo alla volta per allenamento evita modifiche concorrenti alla stessa sessione. Le cancellazioni usano `deletedAt`, senza rimuovere fisicamente i documenti. Non eliminare o modificare manualmente i metadati `_sync`; le regole ne impediscono la rimozione una volta presenti.

## Aggiornamenti e ripristino

Il service worker usa `registerType: 'prompt'`: il codice può segnalare una nuova versione e applicarla dopo la scelta dell’utente. Il precache contiene solo gli asset dell’app; lo storico personale rimane in IndexedDB. Il comportamento del plugin è descritto nella [guida Vite PWA](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html).

Pubblica una release completa in una directory nuova e cambia il riferimento `current` in modo atomico. Mantieni disponibili gli asset con hash della release precedente durante il passaggio: una pagina già aperta potrebbe averne ancora bisogno. Non caricare un nuovo `index.html` prima degli asset che cita.

Per ripristinare una release precedente, ripubblica il suo insieme completo di file. Il ripristino del frontend non deve cancellare IndexedDB o i documenti Firestore. La cancellazione dei dati del sito non è una procedura di aggiornamento: potrebbe eliminare modifiche ancora da sincronizzare.

## Diagnosi rapida

| Sintomo | Controllo |
| --- | --- |
| È disponibile solo la demo | Le quattro variabili `VITE_FIREBASE_*` devono essere valorizzate prima della build. |
| Google segnala configurazione del dominio | Confronta host corrente, `authDomain`, dominio autorizzato e URI OAuth. |
| Google richiede la configurazione del collegamento | Configura gli account distinti per provider nella console, poi ricrea la build con `VITE_FIREBASE_EXPLICIT_LINKING=true`. |
| Dopo Google riappare la pagina di accesso | Verifica che `/__/auth/` arrivi agli helper Firebase e non restituisca `index.html` o un redirect del server. |
| Dati locali presenti ma sincronizzazione in errore | Controlla connessione, accesso corrente, progetto Firebase e regole del database. Non cancellare lo storage locale. |
| Build nuova non visibile | Controlla cache di HTML e `sw.js`, attendi il rilevamento della versione e accetta l’aggiornamento nell’app. |
| Pagina bianca dopo una release | Verifica richieste 404 degli asset con hash e coerenza dell’intera cartella `dist/`. |


## Aggiornamento della demo — 11 settembre 2026

Le due iterazioni sui feedback introducono `workStartedAt`, `pausedAt`, `pausedDurationMs`, `energy` e `sleepHours` nelle sessioni e `durationMs` nelle serie. Le note della conclusione continuano a usare il campo `note` della sessione.

Pubblica le regole `firestore.rules` aggiornate **prima** di distribuire questa build agli account reali: le regole precedenti rifiutano i nuovi campi. I campi sono facoltativi nei documenti per mantenere compatibili i dati già salvati; non occorre cancellare, ricreare o completare artificialmente lo storico. La demo locale non richiede Firebase.

| Campo | Valori ammessi |
| --- | --- |
| `energy` | Assente o `null` per dati precedenti; quando registrato, intero da 1 a 5. |
| `sleepHours` | Assente o `null` per dati precedenti; quando registrato, numero da 0 a 24 a intervalli di 0,5 ore. |
| `note` | Testo fino a 5000 caratteri; può essere vuoto. |

Il nuovo form richiede energia e sonno prima di concludere una sessione con serie salvate. Le medie escludono i dati mancanti e includono zero ore soltanto se esplicitamente registrato. Non è prevista una migrazione che ricostruisca questi valori per il passato.

Se devi ripristinare una build precedente, conserva regole che accettino anche i nuovi campi finché esistono sessioni che li contengono o modifiche in coda. Ripristinare le vecchie regole potrebbe impedire la sincronizzazione delle sessioni aggiornate. La correzione dallo storico salva l’intero documento della sessione: la politica esistente di ultima scrittura fra dispositivi vale anche per energia, sonno e note.

## Profilo modificabile — 11 settembre 2026

Prima di distribuire il frontend, pubblica anche `firestore.rules` e `firestore.indexes.json`: il profilo personale usa il documento privato `users/{uid}/profile/main`, accessibile solo al proprietario, con `displayName`, `photoURL` e `updatedAt` assegnato dal server. I vecchi account funzionano senza migrazione: fino alla prima modifica l’app mostra nome e foto forniti da Firebase Authentication, compresa la foto Google disponibile.

Nome e foto vengono salvati insieme e prevalgono sui dati del provider anche ai successivi accessi. Il nome accetta da 1 a 80 caratteri. Le immagini caricate sono ridimensionate dal browser in JPEG e conservate nel documento, con un limite di 180.000 caratteri per la data URL; le foto predefinite Google sono URL HTTPS fino a 2048 caratteri. Il campo foto è escluso dagli indici. Questa funzione usa il database esistente e non richiede Firebase Storage.

Il salvataggio del profilo richiede la connessione e viene confermato dopo la transazione Firestore; non usa la coda offline degli allenamenti. Una cache in localStorage, separata per UID, mantiene l’ultimo profilo disponibile sul dispositivo. Le personalizzazioni della demo rimangono esclusivamente in sessionStorage e non vengono inviate a Firebase. Il logout conserva la cache degli account, come avviene per gli allenamenti locali.
