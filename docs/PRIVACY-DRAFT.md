# BOZZA INTERNA — Informativa privacy Kynlift

**Stato: da completare prima della pubblicazione. Non distribuire come informativa agli utenti.**

Preparata l’11 settembre 2026 sui dati dichiarati dal titolare e sui flussi presenti nel repository. Le sezioni descrittive seguenti sono già utilizzabili per la revisione; le decisioni aperte sono esplicitate in fondo, senza attribuire al titolare impegni o basi giuridiche non confermati.

## Titolare e contatti

Il titolare del trattamento è **Moris Doratiotto**. Per informazioni sui dati personali e per esercitare i tuoi diritti puoi scrivere a **[me@moris.dev](mailto:me@moris.dev)**.

## Quali dati usa Kynlift e per quali funzioni

Kynlift è un diario di allenamento. Consente di organizzare esercizi e schede, registrare le serie, conservare lo storico e visualizzare i propri progressi.

| Dati | Utilizzo nell’app |
| --- | --- |
| Nome, foto profilo facoltativa, indirizzo email, identificativo dell’account e metodi di accesso collegati | Creazione dell’account, accesso, riconoscimento del proprio spazio e collegamento esplicito di Google ed email/password. Nome e foto possono essere modificati dal profilo. |
| Password, se scegli email/password | Autenticazione tramite Firebase Authentication. Il modello dei dati degli allenamenti non memorizza la password. |
| Esercizi, attrezzatura, gruppi muscolari, schede, obiettivi e note | Organizzazione dell’allenamento e ripresa delle proprie impostazioni. |
| Carichi, ripetizioni, RIR, eventuali valori distinti per lato, date, tempi, recuperi e stato delle sessioni | Registrazione delle serie, ripresa dell’allenamento e confronto delle prestazioni. I carichi sono quelli utilizzati negli esercizi; non è previsto un campo dedicato al peso corporeo. |
| Energia percepita, ore di sonno e note sulla sessione | Riepilogo dell’allenamento e consultazione delle informazioni nello storico e nei progressi. |
| Identificatori dei documenti e dell’installazione, revisioni, sequenze e date di sincronizzazione | Associazione dei dati al proprio account, salvataggio locale e sincronizzazione delle modifiche. |

L’accesso con Google rende disponibili all’app nome, foto profilo se presente, email, identificativo e informazioni sul metodo di accesso. La foto predefinita viene caricata dall’indirizzo HTTPS fornito da Google. Kynlift non richiede autorizzazioni per leggere Gmail, contatti o calendario.

Nella versione esaminata, energia e ore di sonno sono richieste per completare un nuovo allenamento; le note aggiuntive sono facoltative. L’energia usa una scala da 1 a 5 e il sonno può essere indicato a intervalli di mezz’ora. Questi valori possono essere modificati dallo storico. Le registrazioni precedenti che non li contengono restano leggibili.

## Salvataggio sul dispositivo e sincronizzazione

I dati di allenamento vengono salvati nel browser tramite IndexedDB, in spazi distinti per ciascun account e per la demo. Le modifiche in attesa di invio sono conservate in una coda locale. Per un account reale, quando le condizioni di connessione e autenticazione lo consentono, vengono sincronizzate con Cloud Firestore.

L’autenticazione usa la persistenza locale del servizio Firebase Authentication. La scelta di usare la demo viene conservata anche nella memoria di sessione del browser. La PWA conserva copie delle risorse dell’app tramite il service worker per consentirne l’apertura anche senza rete.

Il nome e la foto personalizzati vengono salvati insieme in un documento privato Cloud Firestore quando il dispositivo è connesso. Le immagini scelte vengono ridimensionate dal browser in JPEG prima dell’invio; il file originale non viene caricato. L’ultimo profilo confermato viene conservato anche in localStorage, separatamente per ciascun account. La demo conserva nome e foto personalizzati nella memoria di sessione e non li invia a Firebase. Uscire dall’account mantiene anche la copia locale del profilo.

Uscire dall’account non cancella gli allenamenti già presenti sul dispositivo. La rimozione dei dati del sito dalle impostazioni del browser riguarda le copie locali e non elimina le copie associate all’account sul server; può anche rimuovere modifiche non ancora sincronizzate.

## Demo

La demo usa dati di esempio e uno spazio locale separato. Le modifiche degli allenamenti della demo non vengono inviate a Firestore. Nelle impostazioni puoi ripristinare i dati della demo.

Questo riguarda i contenuti degli allenamenti: non equivale a dire che la visita del sito non produca richieste di rete. Nelle build con Firebase configurato, il servizio di autenticazione viene inizializzato all’avvio, prima della scelta fra accesso e demo.

## Servizi utilizzati

Kynlift utilizza **Firebase Authentication** per l’accesso e **Cloud Firestore** per i dati degli account reali. Firebase documenta anche il trattamento di indirizzi IP e informazioni sul browser nell’autenticazione, per sicurezza e prevenzione degli abusi. La sua documentazione indica che Firebase Authentication elabora i dati negli Stati Uniti. La localizzazione del database Firestore del progetto deve essere verificata separatamente. Queste informazioni non costituiscono una dichiarazione che tutti i dati rimangano nell’Unione europea. [Privacy e sicurezza di Firebase](https://firebase.google.com/support/privacy).

Nel codice applicativo esaminato non risultano integrazioni Google Analytics, strumenti pubblicitari, pixel di marketing o servizi di monitoraggio degli utenti. Le statistiche dei progressi sono calcolate a partire dai dati degli allenamenti dell’utente. Questa verifica del codice non descrive i log o eventuali servizi aggiunti dal gestore dell’infrastruttura di produzione.

## Esportazione, eliminazioni e conservazione attuali

Nelle impostazioni puoi esportare un file JSON con i dati degli allenamenti presenti sul dispositivo. Collegarsi prima a Internet consente di ricevere le modifiche degli altri dispositivi; il file non è un’esportazione completa dei dati gestiti dal servizio di autenticazione o dei log dei fornitori.

Le eliminazioni nell’app contrassegnano i record come eliminati per propagarne lo stato agli altri dispositivi. Il contenuto dei record può quindi restare nelle copie locali e remote: l’eliminazione dall’interfaccia non è una cancellazione definitiva di tutte le copie.

Il codice attuale non applica un periodo automatico di conservazione agli allenamenti e non include una funzione di eliminazione dell’intero account. Una durata o un criterio definitivo di conservazione e una procedura per le richieste di cancellazione devono essere definiti prima di pubblicare l’informativa.

## Diritti

Nei casi e alle condizioni previsti dal GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione del trattamento e portabilità, e opporti ai trattamenti per i quali il diritto di opposizione è previsto. Per i trattamenti eventualmente fondati sul consenso dovrà essere possibile revocarlo. Per queste richieste il contatto del titolare è [me@moris.dev](mailto:me@moris.dev). La descrizione dei diritti segue le [informazioni della Commissione europea](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en).

Puoi inoltre proporre reclamo all’autorità di controllo competente. In Italia puoi consultare le [indicazioni del Garante per la protezione dei dati personali](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/2007811).

## Sezioni da finalizzare — solo per la revisione interna

**Basi giuridiche.** Non è stata attribuita una base giuridica definitiva ai trattamenti. Per l’erogazione del servizio richiesto dall’utente si può valutare l’articolo 6, paragrafo 1, lettera b), documentandone necessità e ambito; tale ipotesi non risolve da sola l’eventuale trattamento di dati relativi alla salute. Gli articoli 6 e 9 disciplinano aspetti distinti. [GDPR, testo ufficiale](https://eur-lex.europa.eu/legal-content/IT-EN/TXT/?uri=CELEX%3A32016R0679).

**Energia, sonno e note.** Questi dati, soprattutto combinati nello storico o con note su condizioni fisiche, possono rivelare informazioni sulla salute. È una valutazione da completare sul trattamento concreto, non una classificazione automatica di ogni carico o ripetizione. Se si applica l’articolo 9, occorre individuare e attuare una delle condizioni previste. Se si sceglie il consenso esplicito, il testo deve corrispondere a raccolta, registrazione e revoca effettivamente disponibili. Il semplice uso dell’app o l’accettazione dell’informativa non vanno descritti come un consenso già acquisito. [GDPR, articolo 9 e considerando 35](https://eur-lex.europa.eu/legal-content/IT-EN/TXT/?uri=CELEX%3A32016R0679); [Commissione europea, condizioni del consenso](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en?prefLang=ro).

**Conservazione ed erasure.** Devono essere approvati i tempi o criteri di conservazione di account, allenamenti, record eliminati, copie di backup e richieste ricevute dal titolare. Serve una procedura operativa per cancellare i dati remoti e gestire le copie locali e le modifiche ancora in coda. Il solo logout e i tombstone non soddisfano questa procedura.

**Destinatari e trasferimenti.** Devono essere documentati il provider del server frontend e dei suoi log, la localizzazione effettiva di Firestore, i termini applicabili ai servizi e le garanzie utilizzate per i trasferimenti internazionali. Non sono state inserite regioni, fornitori hosting o garanzie contrattuali non verificati.

Le decisioni e i riscontri richiesti per rendere questa bozza pubblicabile sono raccolti in [PRIVACY.md](PRIVACY.md).
