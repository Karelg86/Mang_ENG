# 🔄 Quick-Resume: Moduli MangaKatana ENG e Vortex Scans per Shirox

Manuale di riferimento creato il 2026-09-12, aggiornato il 2026-10-16.

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

Struttura URL: manga `https://mangakatana.com/manga/{slug}.{id}`, capitolo `.../{slug}.{id}/c{num}`

## ⚙️ Vortex Scans (`vortex_extractor_v2.js`)

1. **`searchResults(keyword)`** — GET `/series/?searchTerm={kw}` (lo **slash finale in `/series/` è obbligatorio**, altrimenti redirect 301 verso http)
   - Dati estratti dal payload JS della pagina: `slug:"...",postTitle:"..."`, cover da `featuredImage`
   - ⚠️ Gli slug possono contenere apostrofi (`the-veteran-swordmaster's-stream`) e i titoli caratteri escapati: le stringhe vengono lette per intero e de-escapate
2. **`extractDetails`**, **`extractChapters`**, **`extractImages`** — dal payload JS delle pagine serie/capitolo
   - ⚠️ I capitoli a pagamento (`isLocked:!0`, `price` in coins) vengono esclusi: aperti mostrano solo l'immagine "bloccato"
   - Il sito limita le richieste ravvicinate (connessione resettata): una ricerca vuota va riprovata prima di considerarla un errore

## Rete debole (`soraFetch`)
- Ogni richiesta viene ritentata fino a **3 volte** (pausa 1 s, poi 2 s) se la rete fallisce o il server risponde 5xx/429/408; stop dopo ~50 s (Shirox concede 120 s a ogni funzione del modulo)
- Le **immagini** le scarica Shirox (Kingfisher, timeout 15 s, nessun retry): il modulo non può intervenire. Se una pagina non carica: "Tap to retry" sulla pagina

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

- **2026-10-16 — MangaKatana 1.0.4 / Vortex Scans 1.0.4**: retry delle richieste in `soraFetch` (rete 4G/E e reset di connessione di Vortex): prima un errore di rete dava subito "No pages found". Backup pre-modifica in `Repository_Kappa\_backup\2026-10-16_pre-retry\`
- **2026-10-13 — MangaKatana 1.0.3**: ordine capitoli corretto per i sotto-capitoli a 2 cifre (Berserk 0.10 era duplicato di 0.1 e 0.11–0.16 finivano prima di 0.2); extra senza "Chapter N" numerati dall'URL (prima si sovrapponevano a capitoli veri, es. Attack on Titan 124/134)
- **2026-10-13 — Vortex Scans 1.0.3**: esclusi i capitoli bloccati a pagamento
- **Verifica 2026-10-13** (siti reali): ricerca → capitoli → pagine OK su capitolo primo/medio/ultimo, immagini HTTP 200. MangaKatana: Berserk, Overgeared, Solo Leveling, One Piece, Attack on Titan, Naruto, Kimetsu no Yaiba, Dandadan. Vortex: Kidnapped Dragons, Murim Psychopath, Solo Swordmaster, The Veteran Swordmaster's Stream, Absolute Domination, Bill The Blacksmith, Regressed Blood Demon, Extra of a Crazy World

- **2026-10-13 — MangaKatana 1.0.2**: gestione redirect con un solo risultato (prima mostrava manga a caso); ricerca senza risultati ora vuota (prima 36 manga a caso + voce `'+title+'`); esclusi i widget dopo la lista; rimosso filtro keyword (perdeva i titoli trovati per nome alternativo); decodifica entità HTML
- **2026-10-13 — Vortex Scans 1.0.2**: trovati anche i titoli con apostrofo nello slug; titoli con caratteri escapati decodificati

**Domini correnti configurati nei file:** `mangakatana.com`, `vortexscans.org`
*(Mantenere quest'ultima riga aggiornata a ogni sostituzione)*
