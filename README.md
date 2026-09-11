# Kynlift

**Preparazione alla produzione aggiornata**: SEO della home prerenderizzata, anteprima social, esclusione delle pagine personali, configurazione Nginx e controlli automatici. La build è in `dist/`; la pubblicazione e le prove di accesso sul dominio reale sono operazioni distinte. Parti dalla [checklist di rilascio](docs/RELEASE.md).

Il tuo allenamento, serie per serie. Kynlift è una PWA pensata per registrare peso, ripetizioni e RIR tra una serie e l’altra, ripartendo dall’ultima prestazione e conservando uno storico confrontabile.

L’interfaccia è in italiano, usa i chilogrammi ed è progettata prima per lo smartphone. La direzione visiva approvata è **Cronometro da pista**: nero, rosa, numeri leggibili e un’azione principale alla volta.

## Avvio locale

Richiede Node.js 22.12 o successivo e pnpm 11.19.0. Le dipendenze sono fissate in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Apri l’indirizzo mostrato da Vite. Puoi esplorare la **demo senza configurare Firebase**: catalogo, schede e allenamenti sono dati sintetici, separati dagli account reali. Le modifiche della demo restano sul dispositivo; non vengono inviate a Firebase.

Per usare un account reale, copia `.env.example` in `.env.local`, inserisci la configurazione del tuo progetto Firebase e riavvia Vite. L’accesso Google in produzione richiede il dominio e il reverse proxy descritti nella [guida di pubblicazione](docs/DEPLOYMENT.md).

## Funzioni

- Schede modificabili: ordine degli esercizi, serie, range di ripetizioni, RIR facoltativo, recupero e note. Duplicazione per creare varianti.
- Catalogo personale con ricerca, gruppi muscolari, attrezzatura, carico totale/per mano, corpo libero con eventuale zavorra e assistenza.
- Selezione allenamento dedicata alle schede: aprirne una mostra prima il riepilogo, con esercizi e obiettivi. Sessione e timer partono soltanto da Inizia allenamento. La sessione aperta mostra avanzamento, Riprendi e Termina; la sezione Schede è dedicata alla gestione.
- Allenamento senza scorrimento della pagina: peso precedente allineato all’obiettivo, peso/ripetizioni/RIR da confermare, serie selezionata centrata nella guida e timer di esecuzione che parte subito e dopo il recupero. Pausa persistente e durata salvata per serie; esercizi, lati separati e opzioni avanzate si aprono in dialog. Il recupero resta definito nella scheda.
- Il peso iniziale proviene dallo storico; le nuove serie riprendono poi l’ultimo carico inserito per quell’esercizio nella sessione corrente, anche dopo riapertura. Le serie già compilate mantengono i propri valori.
- Conclusione con energia espressa da icone e numeri 1–5, sonno regolabile con −/+ di mezz’ora da una base di 7 ore e note facoltative. Questi dati si possono correggere dallo storico insieme ai risultati delle serie, senza cambiare durata e snapshot degli esercizi.
- Progressi divisi in Riepilogo, Esercizi e Storico con periodo condiviso: settimana, mese, 3 mesi o Sempre. Select personalizzati, calendario con ogni giorno del periodo, medie di energia e sonno con numero di osservazioni; andamento, volume, gruppi muscolari e record seguono lo stesso periodo.
- Conferme interne all’app coerenti con la UI per eliminazioni e abbandono delle modifiche.
- Accesso email/password e Google, collegamento esplicito dei metodi allo stesso account, persistenza locale e sincronizzazione. Accesso e ingresso nella demo portano al tab Allenamento; ricaricare una sessione già aperta ne conserva la posizione. La pagina di accesso è fissa; con tastiera o contenuti estesi scorre il pannello dei campi.

## Dati e convenzioni

Ogni modifica salvata passa prima da IndexedDB, in uno spazio separato per account. Una coda durabile ritenta l’invio a Firestore. **Salvato sul dispositivo** e **confermato dal server** sono stati distinti. Se manca la connessione, i dati già disponibili rimangono utilizzabili; il primo accesso richiede Internet.

Le collezioni remote sono `users/{uid}/exercises`, `routines`, `sessions` e `sets`. Le serie hanno documenti separati e identificatori stabili. Gli allenamenti contengono una copia degli esercizi e dei target: rinominare o rimuovere una scheda non modifica lo storico. Le eliminazioni vengono propagate come tombstone.

Usa un dispositivo alla volta per lo stesso allenamento. La modifica concorrente dello stesso documento non combina i campi: prevale l’ultima scrittura applicata sul server.

| Dato | Convenzione |
| --- | --- |
| Peso totale | Peso esterno complessivo, incluso il bilanciere quando presente. |
| Peso per mano | Peso di un singolo carico; il moltiplicatore indica se nell’esecuzione si usano uno o due carichi. |
| Lati separati | Peso e ripetizioni sinistra/destra. Quando i valori destri non sono differenziati, coincidono con quelli sinistri. |
| Corpo libero | Peso `0`; un valore positivo indica soltanto la zavorra. Confronti di ripetizioni a parità di zavorra. |
| Assistenza | Kg forniti dalla macchina: a pari ripetizioni un carico di assistenza minore è il risultato migliore. |
| Volume | Kg esterni × ripetizioni × numero di carichi; nei movimenti unilaterali vengono sommati i lati. Corpo libero, zavorra e assistenza sono esclusi da questo totale. |
| Massimale stimato | Formula di Brzycki, `peso × 36 / (37 − ripetizioni)`, limitata a 1–10 ripetizioni con carico esterno. Esclude corpo libero e assistenza. È una stima. |
| Periodo | Ultimi 7, 30 o 90 giorni di calendario incluso oggi, confrontati con il periodo precedente della stessa lunghezza nel fuso locale. Sempre include tutto lo storico senza confronto percentuale. Predefinito: 30 giorni. |
| Durata | Il tempo della serie parte all’avvio e dopo il recupero e si salva alla conferma. La durata della sessione include il recupero ed esclude le pause esplicite. Le sessioni precedenti restano leggibili senza inventare durate non rilevate. |
| Energia | Valutazione della sessione da 1 a 5: Molto bassa, Bassa, Media, Alta, Molto alta. Nessuna scelta preselezionata per una nuova rilevazione. |
| Sonno | Ore dormite prima dell’allenamento, da 0 a 24 a intervalli di mezz’ora. Accetta anche la virgola decimale. Zero è una rilevazione valida, distinta da un dato mancante. |
| Medie di energia e sonno | Media dei valori registrati nelle sessioni concluse del periodo selezionato, con conteggio delle osservazioni separato per ciascun dato. I valori assenti nello storico sono esclusi, senza convertirli in zero. |
| Il tuo ritmo | Un quadratino per ogni giorno del periodo, compresi i giorni senza allenamenti. Sempre parte dal primo allenamento concluso; gli storici su più anni consentono di cambiare anno. |

Solo le serie confermate di allenamenti conclusi entrano nelle statistiche. I confronti separano esercizio, attrezzatura, modalità di carico, moltiplicatore e gestione dei lati. Il RIR descrive lo sforzo della serie e non corregge la formula del massimale.

`energy` e `sleepHours` sono campi facoltativi nelle sessioni persistite per mantenere compatibili i record precedenti; il nuovo flusso di conclusione richiede entrambi. Le note continuano a usare `note`, con limite di 5000 caratteri. Non serve migrare o cancellare lo storico. Le regole Firestore devono essere aggiornate prima di distribuire la build che salva i nuovi campi.

## Verifica

```sh
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test` esegue i test di dominio, statistiche e persistenza. I test delle regole richiedono Java 21 o successivo e gli emulatori Firebase. I test browser avviano automaticamente l’anteprima della build sulla porta 4173:

```sh
pnpm test:emulators
```

La PWA viene generata dalla build di produzione; il service worker è disabilitato nel server di sviluppo. Per controllare la build:

```sh
pnpm build
pnpm preview
```

La [guida di pubblicazione](docs/DEPLOYMENT.md) include i controlli da fare sul dominio HTTPS e su iPhone/Android prima dell’uso reale.

## Limiti della prima versione

Il timer recupera la scadenza quando torni nell’app; un allarme in background o a schermo spento non è garantito. La conservazione locale dipende dallo spazio e dalle impostazioni del browser: la cancellazione dei dati del sito elimina anche le modifiche non ancora sincronizzate.

La prima versione è per un piccolo gruppo personale. Sono esclusi importazione Excel, social, coaching, smartwatch, superserie/drop set strutturati e misure corporee. Lo storico viene caricato per intero per account: per un servizio pubblico o storici molto grandi serviranno paginazione, aggregati e verifica del consumo Firestore.

La pubblicazione è a carico del proprietario sul proprio server. Il contenuto di `dist/` è il frontend statico; Firebase gestisce autenticazione e dati.

## Documentazione

- [Checklist di rilascio e SEO](docs/RELEASE.md)
- [Controlli automatici CI](docs/CI.md)
- [Pubblicazione e Firebase](docs/DEPLOYMENT.md)
- [Identità e voce del prodotto](docs/BRAND.md)
- [Sistema visivo e componenti](DESIGN.md)
- [Verifiche eseguite e attività rimanenti](docs/VERIFICATION.md)
- [Contesto e decisioni di prodotto](PRODUCT.md)
