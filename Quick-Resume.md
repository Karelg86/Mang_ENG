# 🔄 Quick-Resume: Moduli MangaKatana ENG e Vortex Scans per Shirox

Manuale di riferimento creato il 2026-09-12, aggiornato il 2026-10-21.

## 📦 Repository

- **Repository GitHub:** `https://github.com/Karelg86/Mang_ENG` (branch `master`)
- **Cartella locale:** `C:\Users\kelgazzar\Documents\00_Kappa\17_Repository\Repository_Kappa\Mang_ENG\` (clone git)
- **URL moduli per Shirox:**
  - MangaKatana: `https://raw.githubusercontent.com/Karelg86/Mang_ENG/master/mangeng_manga.json`
  - Vortex Scans: `https://raw.githubusercontent.com/Karelg86/Mang_ENG/master/vortex_manga.json`

## 📄 File nel repository

| File | Descrizione |
|------|-------------|
| `mangeng_manga.json` | **Manifest MangaKatana in uso** (`type: mangas`) → punta a `mangakatana_v2.js` |
| `mangakatana_v2.js` | Script MangaKatana usato da Shirox |
| `mangakatana_extractor.js` | Copia identica di `mangakatana_v2.js` (tenerle allineate) |
| `vortex_manga.json` | **Manifest Vortex Scans in uso** → punta a `vortex_extractor_v2.js` |
| `vortex_extractor_v2.js` | Script Vortex usato da Shirox |
| `vortex_extractor.js` | Copia identica di `vortex_extractor_v2.js` (tenerle allineate) |
| `main.json`, `mangeng.json`, `manganov.json` | ⚠️ Obsoleti: `type: novels` e `scriptUrl` verso `extractor.js` che non esiste (404). Non usarli |

---

## ⚙️ MangaKatana (`mangakatana_v2.js`)

1. **`searchResults(keyword)`** — GET `/?search={kw}&search_by=m_name`
   - Analizza solo la lista `id="book_list"` fino a `id="col_right"`: dopo ci sono i widget (`hot_book`) con lo stesso markup `<div class="item"`
   - **Un solo risultato** → il sito reindirizza alla pagina del manga (niente `book_list`): si usa `<link rel="canonical">`, `<h1 class="heading">` e `og:image`
   - **Nessun risultato** → `[]` (la pagina contiene "Not found any results.")
   - Nessun filtro per keyword: il sito trova anche per titolo alternativo (es. "shingeki no kyojin" → "Attack on Titan")
2. **`extractDetails(url)`** — `div.summary > p`, fallback meta description
3. **`extractChapters(url)`** — `div.chapter > a` dentro `div.chapters`, ritorna `{ "English": [[label, [capitolo]]] }`
   - Numero dal titolo ("Chapter N"), altrimenti dall'URL (`/c18.5`): gli extra tipo "Vol.5 Side Story…" non hanno "Chapter N"
   - ⚠️ Sotto-capitoli a 2 cifre (prologo Berserk 0.1 … 0.16): "0.10" NON è 0.1. Se il manga ha decimali a 2+ cifre, la parte dopo il punto è un indice intero (ordinamento con int + sub/1000, etichetta originale "0.10")
4. **`extractImages(url)`** — array JS `var thzq=[...]`, fallback `var ytaw=[...]`
   - ⚠️ Le immagini (`i1.mangakatana.com/token/...`) contengono token temporanei: la pagina capitolo **non** va messa in cache
   - Quando il sito è in manutenzione risponde 200 con il solo testo `maintenance` (11 byte): ricerca/capitoli vuoti non sono un bug del modulo

Struttura URL: manga `https://mangakatana.com/manga/{slug}.{id}`, capitolo `.../{slug}.{id}/c{num}`

## ⚙️ Vortex Scans (`vortex_extractor_v2.js`)

1. **`searchResults(keyword)`** — GET `/series/?searchTerm={kw}` (lo **slash finale in `/series/` è obbligatorio**, altrimenti redirect 301 verso http)
   - Dati estratti dal payload JS della pagina: `slug:"...",postTitle:"..."`, cover da `featuredImage`
   - ⚠️ Gli slug possono contenere apostrofi (`the-veteran-swordmaster's-stream`) e i titoli caratteri escapati: le stringhe vengono lette per intero e de-escapate
2. **`extractDetails`**, **`extractChapters`**, **`extractImages`** — dal payload JS delle pagine serie/capitolo
   - ⚠️ I capitoli a pagamento (`isLocked:!0`, `price` in coins) vengono esclusi: aperti mostrano solo l'immagine "bloccato"
   - Il sito limita le richieste ravvicinate (connessione resettata): una ricerca vuota va riprovata prima di considerarla un errore
   - Immagini: i link `i0.wp.com` / `i1.wp.com` (proxy WordPress Photon, ricodifica lenta) vengono convertiti in `storage.vortexscans.org` diretto con `directImageUrl()`, sia nel percorso principale (`url:"...",order:N`) sia nel fallback

## Rete debole (`soraFetch`)
- Ogni richiesta viene ritentata fino a **3 volte** (pausa 1 s, poi 2 s) se la rete fallisce o il server risponde 5xx/429/408; stop dopo ~50 s (Shirox concede 120 s a ogni funzione del modulo)
- Le **immagini** le scarica Shirox (Kingfisher, timeout 15 s, nessun retry): il modulo non può intervenire. Se una pagina non carica: "Tap to retry" sulla pagina

## Cache HTML (`fetchHtmlCached`, dalla 1.0.5)
- Shirox apre la scheda chiamando `extractDetails` e **poi** `extractChapters` (in sequenza, stessa URL): la seconda legge la pagina dalla cache invece di riscaricarla → scheda aperta in circa metà tempo di rete
- Cache in memoria: **5 minuti**, max **20 pagine**; si azzera quando si cambia modulo (Shirox crea un contesto JS nuovo)
- Non salva: status non 2xx, pagine < 1000 caratteri (manutenzione), sfide Cloudflare (`_cf_chl_opt`, `<title>Just a moment`)
- Nei log: `[Cache] hit <url>` quando la pagina arriva dalla cache
- Ricerca e pagine capitolo (`extractImages`) **non** passano dalla cache

## Come Shirox esegue il modulo (verificato sul sorgente `xibrox/Shirox`, 2026-10-21)
- Un solo contesto JS per modulo attivo: le variabili globali (cache) restano vive tra una chiamata e l'altra
- `fetchv2` rispetta gli header del modulo (UA Windows Chrome 120)
- Immagini: Shirox manda già `User-Agent` (Mac Chrome 120), `Referer` = origine del sito, `Accept: image/avif,image/webp,...`
- Reader: precarica 9 pagine + lista e prime 3 pagine del capitolo successivo
- `extractImages` può restituire `{ url, headers }` per pagina e `searchResults` `imageHeaders` per le copertine. ⚠️ **Mai mettere `User-Agent` in questi header**: sovrascrive quello del bypass Cloudflare e le immagini vengono rifiutate. Al massimo solo `Referer` (es. URL capitolo per MangaKatana), e solo se un test mostra errori 403
- Le cause di "Page X failed to load" (timeout 15 s, nessun retry) sono dentro Shirox: vanno chieste allo sviluppatore (`.retryStrategy`, timeout 30 s)

---

## 🔁 Procedura di aggiornamento del modulo

1. Modificare lo script (`*_v2.js`) e copiarlo anche nella versione senza `_v2`
2. **Aumentare `"version"` nel manifest** (`mangeng_manga.json` o `vortex_manga.json`). Senza questo Shirox NON vede l'aggiornamento
3. Commit + push su `master`
4. **Aspettare ~10 minuti** (GitHub raw ha cache `max-age=300`, anche iOS la rispetta)
5. In Shirox: chiudere l'app dal multitasking e riaprirla → aggiornamento automatico all'avvio
6. Se non si aggiorna: ricaricare il modulo a mano (metodo sicuro)

## 📝 Cambio dominio

1. Manifest — `baseURL`, `searchBaseURL`, `iconURL` + **aumentare `version`**
2. Script — `BASE_URL` in cima al file
3. Seguire la procedura di aggiornamento sopra

---

## 📜 Storico

- **2026-10-21 — MangaKatana 1.0.5 / Vortex Scans 1.0.5**: cache HTML della pagina manga (`extractDetails` + `extractChapters` = 1 download invece di 2); Vortex: link `wp.com` convertiti in storage diretto anche nel percorso principale di `extractImages` (prima solo nel fallback). Test offline (risposte simulate, 62/62 sui 3 moduli: risultati identici alla 1.0.4) e primo test sul telefono OK (più veloce, capitoli caricano bene). Backup pre-modifica in `Repository_Kappa\_backup\2026-10-21_pre-cache\`. Nota: dal PC `vortexscans.org` non risponde a curl (connessione resettata) e `mangakatana.com` era in manutenzione: test dal vivo sul telefono
- **2026-10-16 — MangaKatana 1.0.4 / Vortex Scans 1.0.4**: retry delle richieste in `soraFetch` (rete 4G/E e reset di connessione di Vortex): prima un errore di rete dava subito "No pages found". Backup pre-modifica in `Repository_Kappa\_backup\2026-10-16_pre-retry\`
- **2026-10-13 — MangaKatana 1.0.3**: ordine capitoli corretto per i sotto-capitoli a 2 cifre (Berserk 0.10 era duplicato di 0.1 e 0.11–0.16 finivano prima di 0.2); extra senza "Chapter N" numerati dall'URL (prima si sovrapponevano a capitoli veri, es. Attack on Titan 124/134)
- **2026-10-13 — Vortex Scans 1.0.3**: esclusi i capitoli bloccati a pagamento
- **Verifica 2026-10-13** (siti reali): ricerca → capitoli → pagine OK su capitolo primo/medio/ultimo, immagini HTTP 200. MangaKatana: Berserk, Overgeared, Solo Leveling, One Piece, Attack on Titan, Naruto, Kimetsu no Yaiba, Dandadan. Vortex: Kidnapped Dragons, Murim Psychopath, Solo Swordmaster, The Veteran Swordmaster's Stream, Absolute Domination, Bill The Blacksmith, Regressed Blood Demon, Extra of a Crazy World

- **2026-10-13 — MangaKatana 1.0.2**: gestione redirect con un solo risultato (prima mostrava manga a caso); ricerca senza risultati ora vuota (prima 36 manga a caso + voce `'+title+'`); esclusi i widget dopo la lista; rimosso filtro keyword (perdeva i titoli trovati per nome alternativo); decodifica entità HTML
- **2026-10-13 — Vortex Scans 1.0.2**: trovati anche i titoli con apostrofo nello slug; titoli con caratteri escapati decodificati

**Domini correnti configurati nei file:** `mangakatana.com`, `vortexscans.org`
*(Mantenere quest'ultima riga aggiornata a ogni sostituzione)*
