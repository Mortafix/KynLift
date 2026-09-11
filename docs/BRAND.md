# Kynlift — identità e voce

Kynlift è il nome approvato del prodotto. Aiuta chi si allena a ricordare il carico, registrare la serie appena fatta e capire come sta progredendo. Il primo pubblico è un piccolo gruppo di persone già abituate alla palestra, con il telefono in mano tra una serie e l’altra.

La promessa operativa è **“Il tuo allenamento, serie per serie.”** Durante l’allenamento il prodotto mette in evidenza obiettivo previsto e risultato effettivo. I valori possono essere precompilati dallo storico, ma diventano un risultato soltanto quando la persona li conferma.

## Direzione: Cronometro da pista

L’identità riprende la chiarezza di uno strumento sportivo: numeri grandi, pochi comandi, contrasto netto e stato immediatamente riconoscibile. Il tempo di recupero e la prossima serie sono contenuti reali dell’interfaccia, non decorazioni.

È approvata la **composizione 2**, quella centrale delle tre proposte Impeccable: peso e ripetizioni in verticale, avanzamento delle serie sul lato. Le due iterazioni sui feedback dell’11 settembre 2026 ripristinano il peso precedente, danno al RIR la stessa importanza di peso e ripetizioni e rendono fissa la pagina della serie. Obiettivo e Ultima volta condividono la riga; i numeri mantengono soltanto etichette e unità. Esercizi, opzioni avanzate e valori per lato si aprono in dialog coerenti. Il recupero usa la durata impostata nella scheda, senza controlli per modificarla durante la sessione.

La conclusione raccoglie come ti sentivi durante l’allenamento, quante ore hai dormito prima e note facoltative. Energia, sonno e note si possono correggere nello storico. Il linguaggio resta descrittivo: una giornata con energia bassa è una rilevazione personale, non un giudizio sulla prestazione. I progressi mostrano medie soltanto sui dati disponibili e un calendario completo per il periodo scelto.

L’app deve sembrare uno strumento personale preciso e accessibile. Il rosa identifica le azioni e i punti di attenzione; il nero lascia spazio ai dati. Non attribuire un genere al pubblico in base alla palette.

| Ruolo | Colore | Uso |
| --- | --- | --- |
| Fondo | `#101014` | Superficie principale e cornice dell’app. |
| Superficie | `#19191F` | Campi, aree operative e separazione dei livelli. |
| Rosa | `#FF4F93` | Azione primaria, selezione e numeri da mettere a fuoco. |
| Testo principale | `#F5F5F7` | Titoli, etichette, valori e contenuto. |

Il tema della prima versione è scuro. Per i pulsanti rosa usare testo scuro, mantenendo leggibili anche focus, errori e stati disabilitati. Stato e significato devono essere espressi con testo o simboli oltre al colore.

## Tipografia e marchio

**Barlow** è la voce dell’interfaccia. **Barlow Condensed** dà spazio ai numeri dell’allenamento e del timer. I font vengono serviti con l’app, così rimangono disponibili offline. Usare cifre tabulari per pesi, ripetizioni e tempo, evitando salti di allineamento.

Il marchio è il wordmark **Kynlift**, affiancato dal monogramma originale **KL** dove lo spazio è limitato. L’icona dell’app deve rimanere distinguibile nelle dimensioni ridotte e nelle maschere dei sistemi operativi. Conservare proporzioni, palette e contrasto del disegno consegnato; non ricostruire il simbolo con un carattere tipografico casuale.

La gerarchia dipende dal compito: durante l’allenamento il dato della serie domina; negli editor prevalgono etichette e campi; nello storico i confronti devono essere leggibili senza affidarsi soltanto al grafico.

## Voce

Italiano diretto, amichevole e concreto. Dare del tu, indicare l’azione e mantenere le frasi brevi. La motivazione emerge dalla continuità dei risultati, senza giudizi sul corpo, gare con altre persone o promesse di trasformazione.

| Situazione | Formulazione |
| --- | --- |
| Avvio | “Inizia allenamento” |
| Risultato reale | “Salva serie” |
| Conclusione | “Termina allenamento” |
| Osservazione personale | “Energia durante l’allenamento” |
| Dato precedente assente | “Non registrata” / “Non registrato” |
| Valori precompilati | “Conferma o modifica i valori.” |
| Recupero | “Riparti quando sei pronto.” |
| Nessuna scheda | “La prossima serie parte da qui.” |
| Salvataggio locale | “Salvato sul dispositivo.” |
| Attesa del cloud | “In attesa di sincronizzazione.” |
| Errore recuperabile | Nominare ciò che non è riuscito e l’azione per riprovare. |

Non confondere “salvato” con “sincronizzato”, obiettivo con risultato, assistenza con peso sollevato o una stima con una prestazione realmente eseguita.

## Regole dell’esperienza

- Una serie in primo piano e un comando principale riconoscibile.
- Peso precedente visibile, RIR richiesto e pagina della serie fissa; recupero fissato nella scheda e timer di esecuzione con pausa persistente.
- Energia e sonno richiesti alla conclusione, con note facoltative e modifica dallo storico. Energia con icone e numeri, senza preselezione; sonno regolabile con −/+ e base 7 ore nelle nuove conclusioni. I dati storici assenti non sono ricostruiti.
- Controlli principali di almeno 48 px, raggiungibili e separati; modifiche rapide senza richiedere gesti nascosti.
- Editor su pagina, con campi raggruppati e progressione chiara. Ricerca e filtri quando il catalogo cresce.
- Unità sempre esplicite: kg, ripetizioni, secondi, ore; virgola decimale accettata.
- Errori vicini al compito, messaggi persistenti e dati inseriti recuperabili dopo un tentativo fallito.
- Dialog dello stesso sistema per esercizi, strumenti, conclusione, eliminazioni e abbandono delle modifiche. Select dei progressi coerenti con campi e palette.
- Movimento breve e funzionale, rispettando la preferenza per animazioni ridotte.
- Nessun dato dimostrativo presentato come risultato reale: la demo deve essere riconoscibile e separata dall’account.

Questo documento conserva l’identità approvata. I dettagli effettivi dei componenti e del sistema visivo sono descritti in `DESIGN.md`, ricavati dalla UI implementata.
