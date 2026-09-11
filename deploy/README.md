# Kynlift — prima pubblicazione

Dominio: `https://kinlift.moris.dev`. Progetto Firebase: `kynlift`.
DNS, provider Auth e creazione Firestore/regole sono dichiarati completati dal proprietario; gli accessi reali non sono ancora verificati.

## 1. Completa il client Google

Apri Google Cloud Console, seleziona il progetto `kynlift`, poi Google Auth Platform → Clients (oppure API e servizi → Credenziali).
Apri il client OAuth di tipo Applicazione web associato a Firebase, spesso chiamato “Web client (auto created by Google Service)”. Se ci sono più client, confronta l’ID con quello nelle impostazioni del provider Google in Firebase.

Aggiungi e conserva anche gli eventuali valori esistenti:

- Origini JavaScript autorizzate: `https://kinlift.moris.dev`
- URI di reindirizzamento autorizzati: `https://kinlift.moris.dev/__/auth/handler`

Salva. In Firebase Authentication → Settings → Authorized domains deve comparire `kinlift.moris.dev`.

Fonte: [proxy trasparente degli helper Firebase](https://firebase.google.com/docs/auth/web/redirect-best-practices#option-3-proxy-auth-requests-to-firebaseappcom).

## 2. Pubblica il frontend

La build `dist/` incorpora la configurazione Firebase e SEO impostata al momento della compilazione. Usa le variabili di `.env.example`, Node compatibile con `package.json` e il lockfile del progetto. Ogni modifica alle variabili richiede una nuova build.

L'indicizzazione è consentita solo quando la build di produzione usa `VITE_SITE_INDEXING=true`. Gli ambienti di prova devono mantenere l'indicizzazione disattivata. Il dominio canonico è definito in `site.config.json`: deve coincidere con `https://kinlift.moris.dev` e con il dominio Auth configurato per questa pubblicazione.

La cartella completa deve comprendere `index.html`, `app.html`, `404.html`, `errors.css`, `robots.txt`, `sitemap.xml`, manifest, service worker, icone e tutti gli asset. `index.html` contiene la pagina pubblica; `app.html` è il documento non indicizzabile per l'area personale. Non pubblicare la directory del repository, `.env.local`, log o file sorgente.

Carica l’intero contenuto di `dist/` nel document root del sito. Il file Nginx propone `/var/www/kynlift/current`: usa quel percorso oppure adatta la direttiva `root` al percorso scelto sul server. `index.html` deve trovarsi direttamente nel document root.

Mantieni una copia della release precedente. Per gli aggiornamenti conserva anche gli asset con hash precedenti durante il passaggio, come descritto in `docs/DEPLOYMENT.md`.

## 3. Configura Nginx e HTTPS

Usa [kinlift.moris.dev.conf.example](kinlift.moris.dev.conf.example) come configurazione aggiornata per questo dominio. Il vecchio esempio generico in `docs/DEPLOYMENT.md` non comprende il routing SEO e gli header di questa versione.

Includi il file nel contesto `http` di Nginx (per esempio tramite `sites-enabled`): contiene direttive `map`, che non possono essere inserite dentro `server`. Se il dominio ha già dei blocchi `server`, integra le direttive senza crearne altri con lo stesso dominio e porta. Mantieni gli `include` globali dei MIME type e l'eventuale gestione esistente di `/.well-known/acme-challenge/` sulla porta 80.

Confronta con il server i percorsi del document root, dei certificati Let's Encrypt e del bundle CA usato da `proxy_ssl_trusted_certificate`. L'esempio usa `/etc/ssl/certs/ca-certificates.crt`, comune su Debian/Ubuntu; altre distribuzioni possono usare un percorso diverso. Il proxy verifica il certificato TLS di Firebase: non disabilitare la verifica per aggirare un bundle mancante. Se il certificato del dominio non è ancora stato emesso, configura prima HTTPS con la procedura già usata sul server.

Il proxy degli helper `/__/auth` e `/__/firebase` raggiunge `https://kynlift.firebaseapp.com`, mantenendo percorso, metodo e query. Le risposte usano `no-store`, non vengono compresse né registrate nell'access log del sito e conservano la policy di iframe/CSP restituita da Firebase. Escludi questi percorsi anche dalle cache e dalle trasformazioni di eventuali CDN. Il service worker deve escluderli dal fallback offline.

Il template applica HTTPS e HSTS al solo host, `nosniff`, referrer policy, limitazione di camera/microfono/geolocalizzazione e protezione dall'incorporamento dell'app in iframe. La CSP limita base URL, oggetti incorporati e frame genitori; non è una whitelist degli script. Eventuali restrizioni CSP aggiuntive vanno provate anche con gli accessi Google reali, senza applicare la policy dell'app agli helper Firebase.

Gli header vengono definiti una sola volta nel blocco `server`. Aggiungere `add_header` dentro una `location` può eliminare l'ereditarietà degli altri header: conserva questo schema anche adattando il template. [Regole Nginx di ereditarietà](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header).

| Richiesta | Risposta prevista |
| --- | --- |
| HTTP | `308` verso l'host HTTPS canonico, conservando percorso e query. |
| `/` | `200`, pagina pubblica, `Cache-Control: no-cache`. |
| `/index.html` | `308` verso `/`, conservando la query. |
| Rotte dell'account, per esempio `/schede` e `/storico/ID` | `200`, `app.html` con `X-Robots-Tag: noindex, nofollow`. |
| URL sconosciute, `/app.html`, `/404.html` | Vero `404`, pagina di errore non indicizzabile. |
| `/assets/` con file esistente | Cache annuale `immutable`; una risposta `404` non riceve cache lunga. |
| HTML, service worker, manifest e altri file senza hash | `no-cache`, per rivalidare gli aggiornamenti. |
| Helper Firebase | Proxy trasparente, `no-store`, `noindex`. |

Il fallback riguarda solo le rotte definite in `src/App.tsx`: aggiornare il template quando si aggiungono rotte. I file mancanti e gli URL inventati non devono restituire la home con stato `200`. Il `noindex` riduce l'indicizzazione, mentre l'accesso ai dati resta protetto da Authentication e dalle regole Firestore.

### Verifica ripetibile prima di attivare Nginx

Con Python 3, OpenSSL e Nginx con supporto SSL disponibili:

```sh
python3 deploy/verify-nginx.py --dist dist
```

Lo script copia la build in una directory temporanea, avvia Nginx solo su localhost e verifica 32 casi reali: pagina pubblica, rotte private, veri 404, redirect, cache 200/304/404, header di sicurezza e proxy OAuth GET/POST con query, body e verifica TLS. L'upstream è un helper fittizio locale; non contatta Firebase, non usa credenziali reali e termina i processi al termine. Senza `--dist` usa file di prova; `--nginx /percorso/nginx` consente un eseguibile specifico.

Sul server, verifica e ricarica con il metodo previsto dalla sua installazione. Per Nginx gestito da systemd:

```sh
sudo nginx -t
# Solo dopo che il controllo è passato:
sudo systemctl reload nginx
```

Il template è stato verificato localmente con Nginx 1.28.3: sintassi valida e 32 controlli superati sia sui file di prova sia sulla build reale `dist/`. La configurazione non è stata applicata al server; restano necessari `nginx -t` sulla sua configurazione effettiva e le prove del dominio reale.

## 4. Controlli dopo la pubblicazione

- `https://kinlift.moris.dev` carica Kynlift con certificato valido.
- La rotta `/schede` funziona anche dopo il ricaricamento della pagina.
- Il sorgente HTTP di `/` contiene titolo, descrizione e canonical corretti; `/schede` ha `noindex` anche senza eseguire JavaScript.
- `/robots.txt` e `/sitemap.xml` restituiscono i file corretti; la sitemap contiene solo la home pubblica.
- `/pagina-inesistente` e `/assets/file-inesistente.js` rispondono `404`; `/index.html` reindirizza a `/`.
- Gli asset esistenti hanno cache `immutable`; HTML, manifest e service worker sono rivalidabili. Verifica gli header anche passando attraverso un eventuale CDN.
- `/__/auth/iframe` restituisce l’helper Firebase, non la pagina Kynlift.
- Creazione/accesso email e password funzionano e mostrano dati personali, senza storico demo.
- Per collegare Google a un account con password, prima accedi con la password e usa Collega Google dalle impostazioni; l’UID e lo storico devono restare gli stessi.
- Il login Google ritorna all’app anche su Safari/iPhone.
- Dopo caricamento online, salva una serie offline, riapri e riconnetti: verifica sincronizzazione e assenza di duplicati.
- Verifica con due account reali che gli storici restino separati.
- A sito pubblico, verifica la proprietà del dominio in Google Search Console e invia la sitemap. Il token di verifica va ottenuto dall'account del proprietario; non è stato generato né configurato da questo lavoro.

La guida completa, inclusi aggiornamenti PWA e diagnosi, è in `docs/DEPLOYMENT.md`.
