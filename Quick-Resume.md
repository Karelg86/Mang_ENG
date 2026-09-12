# 🔄 Quick-Resume: Modulo MangaKatana ENG per Sora/Shirox

Manuale di riferimento creato il 2026-09-12.

## 📦 Repository

- **Repository GitHub:** `https://github.com/Karelg86/Mang_ENG`
- **URL modulo per Shirox/Sora:** `https://raw.githubusercontent.com/Karelg86/Mang_ENG/main/main.json`
- **Cartella locale:** `d:\Sora_Sulfur\MangENG_Git\`

## 📄 File nel repository

| File | Descrizione |
|------|-------------|
| `main.json` | Configurazione del modulo (sourceName, baseUrl, searchBaseUrl, scriptUrl) |
| `extractor.js` | Script di estrazione: ricerca, dettagli, capitoli e pagine immagini |
| `Quick-Resume.md` | Questo file |

---

## ⚙️ Architettura tecnica MangaKatana

### Funzioni dell'extractor

1. **`searchResults(keyword)`** — Cerca su `/manga?search={keyword}&search_by=book_name`, regex su `div.wrap_img > a + h3.title`
2. **`extractDetails(url)`** — Descrizione da `div.summary > p`, fallback meta description
3. **`extractChapters(url)`** — Lista capitoli da `div.chapter > a href`, ordine invertito (crescente)
4. **`extractText(url)`** — Pagine immagini dall'array JS `var thzq=[...]` nella pagina capitolo (metodo primario verificato)

### Tipo modulo
- `"novel": true` — il player usa `extractChapters` + `extractText` (NON `extractStreamUrl`)
- `"streamType": "novels"` — visualizzatore immagini/testo

### Struttura URL MangaKatana
- Manga: `https://mangakatana.com/manga/{slug}.{id}`
- Capitolo: `https://mangakatana.com/manga/{slug}.{id}/{chapId}` (es. `c100`, `c1.5`)

### ⚠️ Nota tecnica: immagini capitoli
Le immagini non sono nell'HTML diretto ma in un array JavaScript:
```javascript
var thzq = ['https://url1.jpg', 'https://url2.jpg', ...];
```
`soraFetch` (URLSession) riesce a leggere questo contenuto. Se non funzionasse, sarebbe necessario `networkFetchNative` (WebView).

---

## 📝 Procedura di aggiornamento dominio

Quando il dominio di MangaKatana cambia:

1. **`main.json`** — aggiornare `baseUrl`, `searchBaseUrl`, `iconUrl`
2. **`extractor.js`** — sostituire tutte le stringhe con il vecchio dominio
3. **Push:**
   ```bash
   cd d:\Sora_Sulfur\MangENG_Git
   git add .
   git commit -m "Aggiornato dominio a NUOVO_DOMINIO"
   git push
   ```
4. Ricaricare il modulo in Shirox/Sora

---

**Dominio corrente configurato nei file:** `mangakatana.com`
*(Mantenere quest'ultima riga aggiornata a ogni sostituzione)*
