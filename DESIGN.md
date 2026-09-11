---
name: Kynlift
description: "Cronometro da pista: numeri leggibili, una serie alla volta."
colors:
  background: "#101014"
  surface: "#19191f"
  surface-raised: "#22222a"
  accent: "#ff4f93"
  accent-hover: "#ff78aa"
  text: "#f5f5f7"
  text-secondary: "#b4b4bf"
  border: "#33333e"
  control-border: "#454551"
  tag-background: "#24242c"
  tag-text: "#c5c5d0"
  error-text: "#ffb1c9"
  error-background: "#301b25"
  success-text: "#bde1c8"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(46px, 5.7vw, 76px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-.02em"
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(42px, 4.8vw, 64px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-.015em"
  title:
    fontFamily: "Barlow, sans-serif"
    fontSize: "clamp(32px, 4vw, 46px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-.025em"
  section:
    fontFamily: "Barlow, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.015em"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  button:
    fontFamily: "Barlow, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  tag: "6px"
  navigation: "8px"
  field: "10px"
  control: "12px"
  panel: "14px"
  circle: "50%"
spacing:
  compact: "8px"
  control-gap: "10px"
  small: "12px"
  medium: "16px"
  gutter-mobile: "20px"
  panel: "24px"
  gutter-desktop: "28px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.field}"
    padding: "11px"
    width: "48px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    padding: "8px 0"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  tag:
    backgroundColor: "{colors.tag-background}"
    textColor: "{colors.tag-text}"
    rounded: "{rounded.tag}"
    padding: "6px 9px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.navigation}"
    padding: "12px 16px"
  navigation-active:
    textColor: "{colors.accent}"
  number-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  set-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.circle}"
    width: "48px"
---

# Design System: Kynlift

## Overview

**Creative North Star: "Cronometro da pista"**

Kynlift ha il carattere di uno strumento da palestra: fondo scuro, numeri grandi, controlli diretti e un accento rosa che segnala l'azione e il punto attivo. La coppia Barlow e Barlow Condensed lega il testo quotidiano al ritmo di un cronometro.

La densità segue il compito. I valori da registrare ricevono spazio e contrasto; le informazioni di contesto restano più piccole, ma leggibili. Schede, storico e progressi usano righe, divisori e gruppi ordinati. L'interfaccia è in italiano, con un tono diretto e amichevole, e il tema implementato è scuro.

**Key Characteristics:**

- Numeri condensati e tabulari per risultati, carichi e tempi.
- Rosa per azioni, selezione e dati in evidenza.
- Superfici antracite, bordi sottili e profondità contenuta.
- Controlli principali raggiungibili con il pollice e focus visibile.
- Marchio Kynlift con monogramma KL originale.

## Colors

La palette combina il nero del fondo, superfici antracite e testo quasi bianco con un solo accento di marca rosa. I valori nel frontmatter sono normativi; i nomi qui descrivono il loro uso.

### Primary

- **Rosa cronometro** (`accent`): azione primaria, serie selezionata, navigazione attiva, andamento dei grafici e piccoli indicatori.
- **Rosa di passaggio** (`accent-hover`): risposta del pulsante primario al puntatore.

### Neutral

- **Nero pista** (`background`): fondo continuo dell'applicazione e testo sui pulsanti rosa.
- **Antracite pannello** (`surface`): campi, scheda di avvio e pannelli numerici.
- **Antracite rialzata** (`surface-raised`): risposta dei pulsanti icona al puntatore.
- **Bianco lettura** (`text`): titoli e valori principali.
- **Grigio contesto** (`text-secondary`): etichette, unità, metadati e navigazione inattiva.
- **Grigio divisore** (`border`) e **grigio controllo** (`control-border`): separazione dei gruppi e contorno dei campi.
- **Antracite etichetta** (`tag-background`) e **grigio etichetta** (`tag-text`): piccoli tag informativi.

Gli stati semantici aggiungono un verde tenue per la conferma e un rosa chiaro su fondo vinaccia per gli errori. Sono accompagnati da testo, senza diventare nuovi accenti di marca.

**The Action Color Rule.** Usa il rosa per azioni, selezioni e informazioni da seguire; mantieni il contesto nella scala neutra.

## Typography

**Display Font:** Barlow Condensed, con fallback sans-serif.

**Body Font:** Barlow, con fallback sans-serif.

Barlow mantiene aperte le etichette e il testo. Barlow Condensed dà compattezza ai numeri e ai titoli legati all'allenamento. I font sono inclusi nell'app: Barlow nei pesi 400, 500, 600 e 700; Barlow Condensed nei pesi 500 e 600.

### Hierarchy

- **Display:** valori principali di peso, ripetizioni e RIR; usa numeri tabulari. Nella pagina fissa dell’allenamento il corpo è 52px su desktop e 46px su mobile; i valori lunghi hanno una riduzione dedicata.
- **Headline:** nome dell'esercizio, con corpo adattabile fra 36px e 54px e interlinea 1.05; su mobile usa 34px e si riduce nei viewport più piccoli. Il nome della scheda nella selezione usa la stessa famiglia condensata, con corpo 34px.
- **Title:** titolo della pagina. Nella maggior parte delle pagine mobili usa 34px.
- **Section:** intestazioni dei gruppi. Le varianti compatte nelle viste operative e nei progressi usano corpi vicini, senza cambiare famiglia.
- **Body:** testo e spiegazioni, con interlinea distesa. Le note lunghe nelle impostazioni e negli editor mantengono larghezze di lettura limitate.
- **Label:** etichette dei campi; metadati e suggerimenti scendono normalmente a 12–14px. Non trasformare le etichette ordinarie in slogan maiuscoli.

**The Stable Numbers Rule.** Usa cifre tabulari per carichi, ripetizioni, tempi e statistiche, affinché l'allineamento resti stabile quando cambiano i valori.

## Layout

Il contenitore ordinario è centrato, con larghezza massima di 1120px e margini interni laterali di 28px. Impostazioni e storico hanno una larghezza massima di 840px; editor delle schede e catalogo arrivano a 860px su desktop. Il ritmo ricorre a spazi di 8, 12, 16, 20, 24 e 32px, con più respiro fra aree indipendenti.

Da 760px la navigazione è nell'intestazione. La home raccoglie le schede in un elenco principale largo al massimo 880px. La pagina di allenamento usa un’unica area operativa larga al massimo 820px, con la guida delle serie a lato dei valori.

Fino a 759px le pagine diventano a colonna singola, con margini di 20px e navigazione fissa inferiore a tre destinazioni. La barra misura 76px più l'area sicura del dispositivo; il contenuto riserva spazio in fondo. Sotto 360px i margini scendono a 16px. Con tastiera aperta la navigazione inferiore e la barra di ripresa si nascondono, mentre le azioni dell'editor tornano nel flusso.

La composizione dell'allenamento mantiene una guida verticale di serie a sinistra di tre pannelli numerici sovrapposti per peso, ripetizioni e RIR. La pagina occupa il viewport disponibile e non scorre verticalmente: possono scorrere soltanto la guida delle serie e i contenuti dei dialog. La guida misura 48px e centra la serie selezionata. Esercizi e opzioni avanzate si aprono nello stesso modello di dialog; i valori per lato usano un dialog dedicato. Con tastiera aperta la superficie operativa privilegia il campo attivo. Griglie degli editor e dei progressi hanno adattamenti specifici a 600px e 700px. Nomi lunghi vanno a capo nei limiti dello spazio operativo; colonne e campi possono restringersi senza imporre scorrimento orizzontale.

## Elevation & Depth

La profondità ordinaria nasce da toni diversi e divisori sottili. Pannelli, schede, campi e navigazione non usano ombre decorative. La conferma temporanea di salvataggio usa una piccola superficie verde con ombra `0 12px 32px #0006`. I dialog usano uno sfondo oscurato e ombra `0 24px 80px #0009` per distinguere il livello che richiede attenzione.

I cambi di stato dei pulsanti usano transizioni brevi di colore e bordo. L'ingresso della conferma dura 220ms; gli indicatori di attesa ruotano. La preferenza di movimento ridotto abbrevia le animazioni e rimuove le rotazioni dedicate.

**The Quiet Surface Rule.** Usa tono e bordo per distinguere le superfici; riserva l'ombra al riscontro temporaneo e ai dialog sovrapposti.

## Shapes

Gli angoli sono morbidi e controllati: tag compatti, navigazione discreta, campi e pulsanti arrotondati, pannelli leggermente più ampi. Le dimensioni normative sono nel gruppo `rounded`. Avatar, tasti di incremento e tappe della guida delle serie sono circolari. I bordi ordinari sono sottili, generalmente di 1px.

Il monogramma KL è un SVG pieno originale e accompagna la scritta esatta **Kynlift**. Mantieni i due tracciati e il rapporto del marchio. Le icone dell'interfaccia sono SVG a tratto, usate insieme a etichette oppure a nomi accessibili.

## Components

### Buttons

Controlli chiari e stabili. Il pulsante principale ha fondo rosa e testo scuro; quello secondario ha fondo antracite e bordo visibile. Il ghost usa testo secondario e si schiarisce al passaggio. I pulsanti icona hanno una superficie interattiva quadrata; quelli testuali usano il rosa e aggiungono una sottolineatura al passaggio.

I pulsanti ordinari hanno altezza minima di 48px. L'azione di conferma della serie è più ampia: 56px su desktop e 52px su mobile. Il focus globale è un contorno rosa di 2px distanziato di 4px; gli editor delle schede usano un distacco di 3px. I pulsanti disabilitati mantengono la forma, riducono l'opacità e bloccano l'azione. Esercizi usa l’icona del manubrio, le opzioni avanzate l’ingranaggio e Termina allenamento la bandiera. Non aggiungere spostamenti o sollevamenti al passaggio.

### Chips

Tag compatti e informativi, con fondo neutro e testo chiaro. Il tag di allenamento in corso include un punto rosa. I tag non sono pulsanti; i filtri selezionabili dei progressi hanno invece bordi e stato attivo propri.

### Cards / Containers

Le superfici piene raccolgono un'azione o un gruppo di campi. Il pannello base usa il relativo token; la scheda di avvio ha 28px di spazio interno su desktop e 24px su mobile. Il suo titolo viene prima dei metadati. Schede, esercizi, storico e risultati usano anche righe aperte separate da bordi: non richiedono un contenitore pieno per ogni elemento.

### Inputs / Fields

Campi antracite con bordo, testo chiaro, cursore rosa, etichetta persistente e altezza minima di 48px. Nella serie attiva bastano etichette e unità: non aggiungere frasi sotto i numeri. Errori e salvataggi hanno testo esplicito; il colore da solo non comunica l'esito. Textarea ridimensionabili e testo a capo restano disponibili negli editor, nella conclusione e nello storico.

I select dei progressi e del RIR nello storico usano lo stesso componente personalizzato: pulsante con valore e chevron, elenco coerente con la palette, selezione marcata e focus visibile. Supportano frecce, Home/End, ricerca digitata, Invio, Escape e Tab. L’elenco si posiziona sopra o sotto il controllo in base allo spazio disponibile.

### Dialog e conclusione dell’allenamento

Esercizi, Opzioni avanzate, valori per lato e conclusione condividono superficie, intestazione con chiusura, spaziatura e comportamento modale. Le conferme interne all’app usano questo sistema anche per eliminazioni e abbandono delle modifiche; la protezione alla chiusura della pagina resta gestita dal browser. Durante un salvataggio i controlli di chiusura sono disabilitati; un errore conserva i valori per consentire il nuovo tentativo.

Termina allenamento mostra le serie completate e richiede Energia durante l’allenamento, da 1 a 5 con numero ed espressione del viso colorata. Le descrizioni da Molto bassa a Molto alta sono nomi accessibili, senza testo visibile sotto i numeri. L’energia non è preselezionata; il sonno parte da 7 ore nelle nuove conclusioni. Il controllo del sonno usa lo stesso linguaggio dei pannelli numerici, con −/+ di mezz’ora e inserimento manuale con virgola, da 0 a 24 ore. Le note sono facoltative. Nello storico il form conserva i valori registrati, incluso zero; un dato assente resta vuoto.

La conferma di annullamento usa il titolo Annullare? e i comandi Riprendi e Conferma, senza ripetere la parola allenamento. Nel profilo Ripristina demo ed Esci condividono la stessa riga e lo stile del pulsante secondario. Il profilo dimostrativo si chiama Arnold Schwarzenegger e mantiene la dicitura Modalità demo.

### Progressi e calendario

Riepilogo, Esercizi e Storico condividono il periodo selezionato. Il tuo ritmo mostra ogni giorno del periodo, anche senza allenamenti, in mesi con griglia da lunedì a domenica. I giorni allenati combinano colore e segno di spunta con una descrizione accessibile. Sempre parte dal primo allenamento concluso e permette di cambiare anno negli storici pluriennali.

Energia e sonno presentano la media e il numero di allenamenti con una rilevazione disponibile, separatamente per ciascun dato. L’assenza è indicata con un trattino; zero ore è un dato registrato e resta incluso. Non dedurre osservazioni dallo storico precedente.

### Navigation

Tre destinazioni: **Allenamento**, **Schede**, **Progressi**. Su desktop sono pulsanti con icona e testo nell'intestazione; l'attivo ha testo rosa e un fondo vinaccia scuro. Su mobile icona e testo si impilano, e un breve tratto rosa indica la destinazione attiva. Lo stato corrente è esposto anche con `aria-current`. L'avatar apre le impostazioni account.

La selezione di una scheda apre un riepilogo su `/allenamento/scheda/:id`: elenco ordinato di esercizi, serie, ripetizioni, recupero e RIR, seguito da Inizia allenamento. Aprire, ricaricare o abbandonare il riepilogo non crea sessioni. Confermare l’avvio sostituisce il riepilogo nella cronologia con la pagina attiva, così Indietro torna alla selezione delle schede.

Accesso esplicito e ingresso nella demo aprono sempre Allenamento; il ripristino automatico dell’accesso al ricaricamento conserva la pagina corrente. Il login occupa l’altezza visibile del dispositivo, senza il titolo Bentornato in pista. Il pannello del form può scorrere con registrazione, errori o tastiera aperta; sugli schermi più bassi header e hero si compattano e il footer lascia spazio alle azioni.

### Pannelli della serie e recupero

Il pannello numerico unisce etichetta, unità, grande valore centrale e due controlli circolari di incremento. Quando contiene il focus il bordo si colora; l'input mantiene il proprio contorno visibile. La guida delle serie distingue la selezione con un disco rosa e le serie già completate con bordo e piccolo punto. Le altre tappe restano scure.

Nell’esercizio attivo l’etichetta è ancorata verso l’alto del pannello, in Barlow 600 e colore `text`: 20px su desktop, 18px su mobile e 17px sotto 360px. L’unità affiancata usa `text-secondary` e peso 400. Valore e pulsanti sono centrati nello spazio rimanente, con una separazione verticale coerente fra tutti e tre i campi. Il layout resta stabile quando il campo perde il focus con la tastiera aperta.

Il peso proposto parte dall’ultima prestazione confrontabile. Nelle nuove serie della sessione corrente prevale poi il carico dell’ultima serie compilata per lo stesso esercizio, inclusi i carichi distinti dei due lati. Bozze e serie già registrate conservano i loro valori; ripetizioni e RIR mantengono i suggerimenti precedenti. Il riferimento Ultima volta continua a mostrare lo storico.

Il timer alterna il recupero a conto alla rovescia e il tempo di esecuzione crescente, che riparte automaticamente alla fine del recupero. La pausa si attiva dal pulsante icona a sinistra di Salva e sospende entrambi i tempi. La durata del recupero resta definita nella scheda. Obiettivo a sinistra e Ultima volta a destra condividono stile e riga, senza icone. Attrezzatura e categoria affiancano il nome dell’esercizio. Non ci sono campi note nei pannelli della serie; le note si raccolgono alla conclusione. Aggiunta e rimozione serie, annullamento e conclusione sono raccolti nel dialog Opzioni avanzate accanto a Esercizi. La guida delle serie centra la selezione quando scorre. Istruzioni delle schede e note dello storico restano disponibili.

## Do's and Don'ts

### Do:

- **Do** scrivere sempre Kynlift e usare il monogramma KL originale.
- **Do** assegnare ai numeri importanti la famiglia condensata e le cifre tabulari.
- **Do** mantenere etichette, unità e stato visibili accanto ai dati.
- **Do** conservare almeno 48px per i controlli principali e un focus chiaramente visibile.
- **Do** adattare colonne, testi lunghi e spazio inferiore alla tastiera e alle aree sicure.
- **Do** usare righe e divisori quando una nuova superficie piena non serve alla gerarchia.

### Don'ts:

- **Don't** introdurre un tema chiaro o un secondo accento di marca nell'attuale sistema.
- **Don't** aggiungere ombre decorative ai pannelli ordinari o movimenti di sollevamento ai pulsanti.
- **Don't** affidare selezione, errore o conferma soltanto al colore.
- **Don't** sostituire le etichette dei controlli con icone prive di nome accessibile.
- **Don't** comprimere i valori operativi per dare più spazio a elementi ornamentali.
