# Verifica Kynlift — 14 settembre 2026

## Ripetizioni MAX come obiettivo — 14 settembre 2026

Rifinitura successiva: Serie, Rep min. e Rep max. sulla stessa riga anche a 320px; etichetta Recupero (s) e RIR senza la dicitura facoltativo. Il badge MAX compare nella testata del campo Ripetizioni soltanto per le serie a cedimento. Build e 5 scenari browser delle schede passati; allineamento e badge verificati a 320, 390 e 1440px. Catture: `.impeccable/review/max-reps-labels/`.

- TypeScript, build di produzione e 81 test unitari passati. I nuovi test coprono indici delle serie MAX, dati precedenti, persistenza, snapshot indipendenti e risultati sempre numerici.
- Verificati 25 scenari browser di schede e allenamento: 24 passati nella prima esecuzione applicativa; corretto il nuovo test MAX per selezionare solo l’obiettivo, usare un esercizio senza storico e attendere la conferma del salvataggio prima del reload. I due scenari MAX ripetuti sulla build finale passano entrambi.
- Confermati selezione singola/Tutte, intervallo numerico conservato, duplicazione, rimozione delle serie, riapertura, MAX nella sessione dopo una modifica della scheda e indicatore storico con il conteggio realmente eseguito.
- 9 catture fra editor, riepilogo e allenamento su 320×740, 390×844 e 1440×1000. Checkbox da 22px dentro controlli da almeno 48px, nessun overflow orizzontale, allenamento fisso e Salva raggiungibile; nessun errore JavaScript.
- Il modello aggiunge solo `maxRepsSets` opzionale nella prescrizione. Le regole Firestore esistenti accettano già questi campi annidati; non sono state modificate né pubblicate. Nessuna migrazione richiesta. Le verifiche di questa sezione usano soltanto dati demo locali.

Catture, script e misure: `.impeccable/review/max-reps/`.

## Preparazione SEO e produzione — 11 settembre 2026

- TypeScript e build pubblica: passati; `check-dist.mjs --production` verifica home prerenderizzata, canonical/schema/social, sitemap, `noindex` privato, 404, risorse e hash precache finali.
- Build demo/staging con variabili Firebase vuote e indicizzazione disattivata: generata in directory temporanea separata e verificata; la build finale in `dist/` è quella pubblica.
- Unit test: 67/67 passati (5 suite), inclusi prerender e regressioni su timestamp remoti. Dopo la correzione del messaggio senza JavaScript, i 4 test di prerender sono stati rieseguiti e passano.
- Emulatori locali: Auth 5/5 e regole Firestore 12/12 passati; nessuna scrittura nel progetto reale.
- Browser Chromium: 24 scenari applicativi esistenti passati, più 4 scenari SEO/offline passati nella verifica finale. La prima prova del nuovo test senza JavaScript ha rilevato un’asserzione `noscript` da correggere; la verifica visiva ha inoltre mostrato il messaggio sovrapposto al logo. Messaggio spostato nel pannello e suite SEO rieseguita: 4/4 passati.
- Nginx 1.28.3 temporaneo: `nginx -t` e 32 controlli HTTP/HTTPS passati sulla build, incluso proxy Auth GET/POST con query e body verso helper locale simulato. Non è una prova di OAuth Google reale.
- Audit dipendenze distribuite: 0 vulnerabilità. Audit completo: 6 moderate transitive di Firebase CLI, nessuna high/critical.
- Verifica visiva: home desktop 1440×900, mobile 390×844, home senza JavaScript, 404 mobile e immagine social 1200×630. Nessun overflow orizzontale nelle schermate esaminate. Confermato il messaggio senza JavaScript dopo la correzione.
- Detector Impeccable eseguito in modalità degradata per parser HTML/CSS non disponibili: ha segnalato principalmente token e dimensioni preesistenti non allineati alla documentazione. Non è stato usato come prova di contrasto o audit completo di accessibilità.
- CI configurata, non eseguita su GitHub. Preflight verificato anche negativamente: l’indicizzazione disattivata blocca la release pubblica.

**Da completare sul servizio reale:** revisione privacy e procedure di conservazione/cancellazione ([dettagli](PRIVACY.md)), configurazione e applicazione server, pubblicazione regole Firestore, accesso/collegamento Google e email, prove iPhone/Android, Search Console. Nessun deploy effettuato. La procedura è in [RELEASE.md](RELEASE.md).


## Quinta iterazione: peso tra le serie ed etichette

- Build di produzione, TypeScript, 61 test unitari e 24 test browser completati con esito positivo.
- La regressione browser verifica aumento e diminuzione del peso, passaggio alla serie successiva, riapertura, conservazione delle serie compilate e isolamento fra esercizi. I test di dominio coprono anche bozze, carico zero, lati separati, sessioni diverse e valori eliminati o invalidi.
- 8 catture su 320×740, 390×844 e 1440×1000, incluse le varianti unilaterale, dialog dei lati e viewport ridotta per tastiera. Nessun overflow, sovrapposizione fra etichetta e unità o pulsante Salva fuori schermo; nessun errore JavaScript.
- Etichette Barlow 600 in `text`, da 17 a 20px secondo il formato; unità in `text-secondary`, peso 400. Contrasto sul pannello: 16,07:1 per le etichette e 8,52:1 per le unità.

Catture e misure: `.impeccable/review/weight-carry/`. Nessuna modifica al modello dati o alle regole Firestore.

## Quarta iterazione: riepilogo e accesso all’allenamento

- Build di produzione e TypeScript completati.
- Tutti i 23 test browser passati. I nuovi scenari verificano che apertura, ricarica e uscita dal riepilogo non creino sessioni, che un doppio clic su Inizia crei una sola sessione e che la ricarica conservi l’allenamento corrente.
- Ingresso nella demo da Progressi e rientro dopo l’uscita dal profilo riportano al primo tab Allenamento. La navigazione dopo gli accessi email e Google è stata aggiornata e revisionata nel codice; non sono stati eseguiti accessi remoti reali.
- Login fisso verificato anche a 320×740, con Accedi ed Esplora la demo visibili. Registrazione e campi restano raggiungibili con viewport ridotta a 320×400. Dopo la correzione degli spazi sul formato piccolo sono stati ripetuti i tre nuovi scenari: tutti passati.
- 20 catture finali su 320×740, 390×844 e 1440×1000, comprese viste con tastiera: login, riepilogo, profilo, esercizio, energia e annullamento. Nessun errore JavaScript o difetto nelle misure automatiche di overflow e raggiungibilità dei controlli.
- Etichette dei controlli numerici più grandi e separate dai pulsanti, energia con sole icone e numeri visibili, conferma di annullamento con Riprendi/Conferma. Scansione meccanica dei componenti modificati senza rilievi.

Catture e misure: `.impeccable/review/routine-entry/`. Le verifiche unitarie e Firestore sotto appartengono alla seconda iterazione; questa revisione non cambia modello dati o regole.

## Terza iterazione: spazi, controlli e accesso

- Build di produzione e TypeScript completati.
- Tutti i 20 test browser passati nella stessa esecuzione. Il test del feedback verifica base 7 ore, incrementi/decrementi di mezz’ora, modifica dello storico e conservazione di zero ore dopo riapertura.
- 17 catture su 320×740, 390×844 e 1440×1000, più viewport ridotta per la tastiera: login, profilo, esercizio con molte serie, nome lungo, feedback e annullamento. Nessun overflow, controllo fuori schermo o errore JavaScript.
- L’area numerica occupa l’altezza disponibile; i pannelli crescono fino a 113 px su mobile standard e 156 px su desktop. Salva e navigazione restano sopra la barra inferiore. Scansione meccanica del layout senza rilievi.
- Profilo demo Arnold Schwarzenegger e comandi Ripristina/Esci sulla stessa riga verificati sulle tre larghezze. Uscita e rientro nella demo verificati senza modificare account reali.
- Login senza i testi rimossi e con header/hero ravvicinati. Google, email, registrazione e recupero password mantengono il codice di autenticazione esistente; non sono stati eseguiti accessi remoti reali.

Catture e misure: `.impeccable/review/final-feedback/`. Le verifiche unitarie e Firestore sotto appartengono alla seconda iterazione: questa revisione modifica l’interfaccia, senza cambiare il modello dati o le regole.

## Verifiche della seconda iterazione

- Build di produzione Vite e controllo TypeScript completati.
- 59 test unitari passati: dominio, statistiche, persistenza e scritture della sessione. Inclusi energia/sonno, compatibilità dei dati precedenti, esclusione delle misure assenti, inclusione di zero ore, calendari completi e confini dei periodi, oltre a RIR, timer e pause.
- 20 scenari funzionali Chromium verificati sulla build di produzione: gestione schede e catalogo, snapshot storico, salvataggio/bozza offline, lati separati, RIR, centratura delle serie, timer/pausa, ripresa e conclusione dalla home, filtri, energia/sonno/note modificabili, conferme custom, Indietro ripetuto e viewport ridotta. Dopo l’ultima correzione dei campi durante il blur sono stati ripetuti i 7 scenari interessati: tutti passati.
- 12 test Firestore passati con emulatore locale: validazione di timer/durata, energia e ore di sonno, rifiuto dei valori invalidi e compatibilità dei dati precedenti. Emulatore arrestato al termine.
- 52 catture a 390×844, 1440×1000 e 320×740 per selezione, sessione aperta, gestione schede, allenamento, pausa, recupero, dialog, feedback finale e tab dei progressi. Nessun overflow orizzontale o errore JavaScript rilevato. La correzione dei comandi sul formato stretto è stata ricontrollata con una cattura mirata.
- Centratura con 12 serie: scostamento verticale entro 1,2 px. Pausa e transizione all’esecuzione confermate a tutte e tre le larghezze.
- Documento senza scorrimento verticale durante l’allenamento sui tre formati; Salva e navigazione fra esercizi restano raggiungibili anche con il nome su più righe. A 320×740, Bulgarian split squat: Salva termina a 564 px e i comandi Precedente/Successivo a 612 px, prima della barra mobile a 663 px.
- Viewport ridotta a 390×500: tutti i campi si possono raggiungere e un singolo tocco su Salva registra la serie. Il layout resta stabile quando il campo perde il focus. A 390×400 i campi sonno e note sono raggiungibili nel dialog senza far scorrere il documento.

Le prove usano esclusivamente dati sintetici della demo e servizi locali. La preview è su `http://127.0.0.1:4173`. Catture e report: `.impeccable/review/refinements/`; la prima iterazione resta documentata nelle catture di `.impeccable/review/feedback/`.

## Comportamento della nuova versione

La Home presenta le schede come punto di partenza, senza suggerimenti, date o storico duplicato. Aprire una scheda mostra il riepilogo degli esercizi; solo Inizia allenamento crea la sessione. La sessione aperta mostra avanzamento, l’etichetta esplicita Esercizio da riprendere e pulsanti Riprendi/Termina. Schede include solo gestione e catalogo. Progressi separa Riepilogo, Esercizi e Storico; i selettori sono personalizzati e il periodo resta comune alle tre viste. Il calendario mostra ogni giorno del periodo: 7, 30, 90 oppure tutto lo storico, con navigazione annuale quando serve.

Durante l’allenamento la pagina resta fissa. Il peso precedente condivide la riga dell’obiettivo, il RIR è obbligatorio e il timer misura l’esecuzione dopo il recupero. Esercizi, opzioni avanzate e valori per lato usano lo stesso dialog. Le conferme dell’app sono personalizzate; l’avviso alla chiusura o ricarica del browser resta gestito dal browser. Il tempo viene registrato sulla serie e resta invariato quando se ne correggono i risultati. Le pause vengono conservate dopo riapertura ed escluse dalla durata totale. I dati storici senza queste misure restano leggibili senza durate ricostruite.

Alla conclusione sono richieste energia da 1 a 5 e ore di sonno da 0 a 24, a intervalli di mezz’ora; le note sono facoltative. L’energia usa icone e numeri senza preselezione. Nelle nuove conclusioni il sonno parte da 7 ore ed è regolabile con −/+ o inserimento manuale. Le osservazioni si modificano nel dettaglio dello storico, conservando anche zero ore e i dati assenti. Le medie dei progressi seguono il periodo e mostrano il numero di rilevazioni: valori mancanti esclusi, zero ore incluso se registrato. Il momento di conclusione è quello in cui si apre il form; compilarlo non allunga la durata della sessione.

## Verifiche su dispositivi reali

La verifica automatica Chromium non sostituisce la nuova prova pratica su iPhone/Android, con tastiera di sistema, cambio app musicale e sospensione del browser. Le verifiche di autenticazione reali dipendono dalla configurazione e dal dominio scelti dall’utente. I precedenti test dell’autenticazione del 10 settembre non sono stati ripetuti; in questa iterazione è cambiata la destinazione dopo un accesso esplicito, mentre il ripristino automatico dell’account conserva la pagina corrente.

Per usare la nuova build con account reali, pubblicare anche le regole Firestore aggiornate, come descritto in `DEPLOYMENT.md`. Nessun servizio remoto è stato modificato in questo intervento.

## Correzioni smartphone e profilo — 11 settembre 2026

- `npm run build:production`: TypeScript, build, configurazione client e controllo degli artefatti PWA/SEO superati.
- `npm test`: 76 test unitari superati, inclusi profilo, cache separata per account, foto Google e indicatori dei metodi di accesso.
- Emulatori Firebase locali: 19 test Auth/Firestore superati, inclusi isolamento del profilo e validazione di nome, foto e timestamp.
- `npm run test:e2e`: 34 scenari Chromium superati sulla build finale. Coprono tutte le pagine mobili, safe area simulate, viewport obsoleto/ridimensionato, tastiera, editor e allenamenti; inoltre anteprima/salvataggio/rimozione foto, nome, riapertura, annullamento e immagini non valide.
- Il ritorno rapido al profilo durante il caricamento di una pagina non ripristina più una bozza scartata: il contenuto delle rotte viene rimontato a ogni cambio pagina.
- Verifica visiva a 402×874 con safe area simulate e a 1440×1000. Resta da verificare la PWA su iPhone reale e il flusso Google sul dominio di produzione.

Prima del frontend pubblicare sia le nuove regole sia gli indici Firestore, come descritto nella sezione «Profilo modificabile» di [DEPLOYMENT.md](DEPLOYMENT.md). La build si trova in `dist/`; questo intervento non esegue il deploy.

### Profilo: modifica su richiesta

Il nome viene mostrato come testo; «Modifica» apre il campo e Salva/Annulla lo richiudono. La sola foto si può cambiare senza aprire il nome. I badge dei provider sono rimossi: «Collega Google» compare solo con password attiva e Google assente, mentre l’icona Google accompagna la mail quando il provider è collegato. Un errore Firestore `permission-denied` non suggerisce più erroneamente di ripetere il login. Anche da localhost, gli account reali richiedono le nuove regole pubblicate sul progetto Firebase.

Build di produzione e 76 test unitari superati; ripetuti e superati i 7 test browser di profilo, accesso e layout mobile. Verificati visivamente lettura/modifica su smartphone e desktop e il salvataggio della sola foto nella demo. Nessuna regola remota pubblicata in questa verifica.

### Errori locali e anteprima foto

Gli errori delle operazioni Auth vengono restituiti al modulo che li ha generati, senza conservarli nel banner globale. Gli errori asincroni del collegamento sono consumati nella schermata account; quelli dei dati sono mostrati nella sezione «I tuoi dati». La modifica del nome usa solo l’icona matita. La foto apre il dialog condiviso con anteprima e comandi «Cambia»/«Rimuovi»; le modifiche vengono confermate con «Salva profilo» e si possono annullare.

Build di produzione, 76 test unitari e tutti i 35 scenari browser superati. Il nuovo scenario forza un errore di validazione nel salvataggio e verifica che non compaia nell’intestazione né sulle altre pagine. Verificati anche errori immagine confinati al dialog, chiusura con Escape, ritorno del focus e layout mobile/desktop. Nessun deploy eseguito.

## Altezza dell’app salvata sulla Home — 11 settembre 2026

Le immagini fornite dall’iPhone mostrano una fascia vuota sotto la navigazione nella PWA installata e campi numerici troppo compressi. Il comportamento è compatibile con [WebKit 254868](https://bugs.webkit.org/show_bug.cgi?id=254868): alcune misure dinamiche delle app installate escludono le safe area anche con `viewport-fit=cover`.

- Altezza condivisa da accesso, pagine e allenamento: `100dvh` nel browser, `100vh` nelle modalità standalone/fullscreen, con fallback `navigator.standalone` per iOS. Le safe area sono applicate nel layout; la tastiera continua a usare il visual viewport.
- L’allenamento compatto risponde all’altezza effettiva del contenuto. Etichette e spaziature si riducono quando serve, conservando i pulsanti numerici di almeno 48px e i controlli all’interno dei riquadri.
- Build di produzione e 76 test unitari superati; tutti i 37 scenari Chromium e i 5 scenari di layout in WebKit superati. La regressione del nome lungo è stata ulteriormente verificata aspettando il completamento del cambio esercizio.
- Nuova regressione PWA: viewport 402×874, safe area 59/34px, misure dinamiche simulate di 781px. Verifica accesso, navigazione, profilo, allenamento e ritorno all’altezza completa dopo la tastiera. Contenimento dei riquadri verificato anche a 402×781 e 320×740.
- Verifica visiva WebKit dell’accesso e dell’allenamento su smartphone e desktop. Catture locali in `/tmp/kynlift-pwa-qa/`. Nessun errore JavaScript nelle pagine esaminate.
- Corretto il refuso del dominio Auth nella configurazione locale ignorata da Git: `kynlift.moris.dev`, coerente con `site.config.json`.

I browser automatici simulano il problema delle misure, ma non eseguono una vera installazione sulla Home di iOS. Resta necessaria la prova sull’iPhone con la nuova build pubblicata. Nessun deploy effettuato; frontend pronto in `dist/`.
