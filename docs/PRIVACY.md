# Revisione privacy prima del lancio

**Esito dell’11 settembre 2026: bozza interna pronta, informativa pubblica non ancora finalizzabile.**

Il titolare comunicato è **Moris Doratiotto**, contatto **me@moris.dev**. La [bozza dell’informativa](PRIVACY-DRAFT.md) contiene questi dati e descrive i flussi verificati. Non è stata creata una pagina in `public/`: la normale build copia i file di quella directory in `dist/`, quindi una bozza potrebbe essere pubblicata per errore.

L’ostacolo non è l’impaginazione. L’informativa deve corrispondere alle basi giuridiche, ai tempi di conservazione e alle operazioni realmente disponibili. Questi contenuti rientrano negli obblighi di informazione descritti dalla [Commissione europea, articoli 12–14 GDPR](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en).

## Decisioni necessarie per finalizzare

| Punto | Situazione verificata | Riscontro necessario |
| --- | --- | --- |
| Base giuridica del servizio | Registrazione, autenticazione e sincronizzazione sono implementate. Nessuna base giuridica è stata dichiarata dal titolare. | Confermare la base per ciascuna finalità e la necessità dei dati richiesti. La bozza propone la valutazione dell’erogazione del servizio, senza dichiararla già adottata. |
| Energia, sonno e note | Energia e ore di sonno sono obbligatorie alla conclusione; le note sono libere. Non esiste un flusso di consenso esplicito o revoca. | Valutare se il trattamento rivela dati sulla salute. Se occorre una condizione dell’articolo 9, sceglierla e tradurla nel prodotto; se si sceglie il consenso, documentare raccolta, prova, revoca e conseguenze. Non aggiungere una checkbox generica per dichiarare risolto il tema. |
| Conservazione e cancellazione | Non c’è scadenza automatica; i tombstone mantengono i contenuti; il logout conserva IndexedDB; manca eliminazione account. | Approvare tempi o criteri e una procedura eseguibile di cancellazione di Auth, Firestore, record eliminati, eventuali backup e copie locali, tenendo conto della coda offline. Verificarla su un account di prova. |
| Infrastruttura e trasferimenti | Il frontend usa Auth e Firestore. Provider hosting, log e regione del database non sono deducibili dal codice. | Identificare l’infrastruttura effettiva, le condizioni contrattuali applicabili e le garanzie dei trasferimenti. Firebase descrive Auth come servizio elaborato negli USA: una regione europea di Firestore non basta a dichiarare tutti i dati residenti in UE. |
| Richieste degli interessati | Sono presenti email di contatto ed export JSON locale. Nessun flusso amministrativo di gestione richieste è documentato. | Stabilire chi gestisce la casella, verifica l’identità e completa richieste, rettifiche e cancellazioni. Definire l’eventuale accesso dei minori senza inserire limiti di età non decisi. |

La necessità di esaminare energia, sonno e note deriva dal trattamento concreto e dalla protezione delle informazioni sulla salute prevista dall’[articolo 9 e considerando 35 GDPR](https://eur-lex.europa.eu/legal-content/IT-EN/TXT/?uri=CELEX%3A32016R0679). La scelta della condizione applicabile richiede una valutazione del titolare con supporto privacy qualificato. Non è stato dichiarato che ogni dato sportivo sia automaticamente un dato sanitario.

Per i fornitori, controllare i [termini privacy di Firebase](https://firebase.google.com/support/privacy) e la [localizzazione del database nella console](https://firebase.google.com/docs/firestore/enterprise/locations#view_the_location_of_your_databases), evitando di trasferire nella policy le durate dei singoli servizi come se fossero la conservazione complessiva di Kynlift.

## Evidenza nel repository

| Fonte | Fatto verificato |
| --- | --- |
| [Modello dati](../src/types.ts) | Account, esercizi, schede, sessioni, serie, energia, sonno, note, date e tombstone. |
| [Autenticazione](../src/auth/AuthContext.tsx), [profilo](../src/auth/profile.ts) e [configurazione Firebase](../src/lib/firebase.ts) | Email/password o Google, collegamento provider, persistenza locale Auth, flag demo in sessionStorage; nessuna eliminazione utente. |
| [Feedback sessione](../src/components/SessionFeedback.tsx) e [validazione](../src/lib/workout-actions.ts) | Energia e sonno richiesti prima della conclusione; note facoltative; modifica dallo storico. |
| [Persistenza locale](../src/data/persistence.ts) | IndexedDB per account/demo, outbox persistente, `deletedAt` con conservazione del contenuto; nessuna cancellazione al logout. |
| [Contesto dati](../src/data/DataContext.tsx) e [sincronizzazione](../src/data/cloud.ts) | Dati demo non inviati a Firestore; account su `users/{uid}`; metadati di revisione e identificatori client. |
| [Impostazioni](../src/pages/Settings.tsx) | Export JSON dei dati locali visibili, ripristino demo, logout; nessun pulsante per eliminare l’account. |
| `src/`, `public/`, `index.html`, `package.json` | Nessun import/inizializzazione di Analytics, Crashlytics, Performance Monitoring, pixel marketing o SDK analoghi trovato nella revisione. Non è una verifica dei servizi aggiunti al server dopo il deploy. |

## Passaggio alla pagina pubblica

Quando le decisioni sono documentate e il comportamento applicativo è coerente, riscrivere la bozza come informativa definitiva e creare una pagina statica accessibile `public/privacy.html`, con stile Kynlift e font locali. Collegarla prima della raccolta dei dati nell’accesso/registrazione e nelle impostazioni. Verificare la pagina senza JavaScript e controllare che la build non includa note interne. Nessuna modifica ai flussi di consenso o all’obbligatorietà dei campi è stata effettuata durante questa revisione.
