/**
 * Test offline per mangakatana_v2.js e vortex_extractor_v2.js (Node.js 18+)
 *
 * Uso:
 *   node test-module.js          -> test OFFLINE con pagine finte (non tocca internet)
 *
 * Gli script vengono caricati in un contesto isolato, come fa Shirox con JavaScriptCore.
 * fetchv2 non esiste in Node: soraFetch usa fetch, qui sostituito da risposte finte.
 * Non c'è un test dal vivo: dal PC vortexscans.org non risponde (connessione resettata)
 * e mangakatana.com è spesso in manutenzione, la prova vera si fa sul telefono.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadExtractor(fileName, fetchImpl) {
  const context = vm.createContext({
    fetch: fetchImpl,
    console: { log() {}, error: console.error },
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, fileName), "utf8"), context, { filename: fileName });
  return context;
}

let failures = 0;
function check(label, condition, detail = "") {
  console.log(`${condition ? "✅" : "❌"} ${label}${detail ? "  ->  " + detail : ""}`);
  if (!condition) failures++;
}

// Le pagine vere superano sempre i 1000 caratteri: sotto quella soglia i moduli non le mettono in cache
const FILLER = `<!-- ${"x".repeat(1200)} -->`;

function makeMockFetch(pages, calls = {}) {
  const fetchImpl = async (url) => {
    calls[url] = (calls[url] || 0) + 1;
    const body = Object.prototype.hasOwnProperty.call(pages, url) ? pages[url] : "";
    return { status: 200, text: async () => body };
  };
  return { calls, fetchImpl };
}

// Le prime risposte per ogni URL sono errori: codice HTTP oppure "rete" (eccezione)
function flaky(pages, failuresList) {
  const base = makeMockFetch(pages);
  const calls = {};
  const fetchImpl = async (url, options) => {
    calls[url] = (calls[url] || 0) + 1;
    const failure = failuresList[calls[url] - 1];
    if (failure === "rete") throw new Error("network down");
    if (failure) return { status: failure, text: async () => "" };
    return base.fetchImpl(url, options);
  };
  return { calls, fetchImpl };
}

async function retryChecks(fileName, pages, url, call, expectedCount) {
  let f = flaky(pages, [503]);
  check("retry: 503 poi ok -> risultati", (await call(loadExtractor(fileName, f.fetchImpl))).length === expectedCount, `${f.calls[url]} richieste`);
  f = flaky(pages, ["rete"]);
  check("retry: errore di rete poi ok -> risultati", (await call(loadExtractor(fileName, f.fetchImpl))).length === expectedCount);
  f = flaky(pages, [404]);
  await call(loadExtractor(fileName, f.fetchImpl));
  check("retry: 404 non ritentato", f.calls[url] === 1, `${f.calls[url]} richieste`);
  f = flaky(pages, [503, 503, 503, 503]);
  const dead = await call(loadExtractor(fileName, f.fetchImpl));
  check("retry: max 3 tentativi poi []", dead.length === 0 && f.calls[url] === 3, `${f.calls[url]} richieste`);
}

// ==========================================
// MANGAKATANA
// ==========================================
async function runMangaKatana() {
  console.log("\n🧪 Test OFFLINE MangaKatana\n");
  const FILE = "mangakatana_v2.js";
  const BASE = "https://mangakatana.com";
  const searchUrl = (kw) => `${BASE}/?search=${encodeURIComponent(kw)}&search_by=m_name`;
  const MANGA_URL = `${BASE}/manga/berserk.55`;
  const CHAPTER_URL = `${MANGA_URL}/c1`;

  const LIST_HTML = `<html>${FILLER}<div id="book_list">
<div class="item"><div class="media"><div class="wrap_img"><a href="${BASE}/manga/attack-on-titan.123"><img src="https://img.example/aot.jpg" alt="x"></a></div></div>
  <div class="text"><h3 class="title"> <a href="${BASE}/manga/attack-on-titan.123">Attack on Titan &amp; Co</a></h3></div></div>
<div class="item"><div class="media"><img data-src="https://img.example/berserk.jpg"></div>
  <div class="text"><h3 class="title"><a href="${MANGA_URL}">Berserk</a></h3></div></div>
<div class="item"><div class="text"><h3 class="title"><a href="${MANGA_URL}">Berserk</a></h3></div></div>
</div>
<div id="col_right"><div id="hot_book"><div class="item"><h3 class="title"><a href="${BASE}/manga/hot.9">Hot Manga</a></h3></div></div></div></html>`;

  const SINGLE_HTML = `<html><head><link rel="canonical" href="${MANGA_URL}"><meta property="og:image" content="https://img.example/berserk.jpg">${FILLER}</head>
<body><h1 class="heading">Berserk</h1></body></html>`;

  // Ordine volutamente mescolato; "0.10" non è 0.1; l'extra non ha "Chapter N" (numero dall'URL)
  const chapterRow = (href, title) => `<tr><td><div class="chapter"> <a href="${MANGA_URL}/${href}">${title}</a></div></td></tr>`;
  const MANGA_HTML = `<html>${FILLER}<div class="summary"> <p>Guts, the Black Swordsman.</p></div>
<div class="chapters"><table>
${chapterRow("c18.5", "Vol.5 Side Story")}
${chapterRow("c1", "Chapter 1: The Brand")}
${chapterRow("c0.16", "Chapter 0.16")}
${chapterRow("c0.10", "Chapter 0.10")}
${chapterRow("c0.2", "Chapter 0.2")}
${chapterRow("c0.1", "Chapter 0.1")}
${chapterRow("c0.1", "Chapter 0.1")}
</table></div></html>`;

  const READER_HTML = `<html>${FILLER}<script>var thzq=['https://i1.mangakatana.com/token/aaa/1.jpg','https://i1.mangakatana.com/token/aaa/2.jpg',];</script></html>`;
  const READER_FALLBACK_HTML = `<html>${FILLER}<script>var ytaw=['https://i1.mangakatana.com/token/bbb/1.jpg',];</script></html>`;

  const pages = {
    [searchUrl("titan")]: LIST_HTML,
    [searchUrl("berserk")]: SINGLE_HTML,
    [searchUrl("zzzz")]: `<html>${FILLER}Not found any results.</html>`,
    [searchUrl("manutenzione")]: "maintenance",
    [MANGA_URL]: MANGA_HTML,
    [CHAPTER_URL]: READER_HTML,
    [`${MANGA_URL}/c2`]: READER_FALLBACK_HTML,
  };

  // --- Ricerca ---
  let mock = makeMockFetch(pages);
  let ex = loadExtractor(FILE, mock.fetchImpl);
  const list = await ex.searchResults("titan");
  check("search: 2 risultati, senza doppioni e senza i widget laterali", list.length === 2, `${list.length}`);
  check("search: titolo con entità decodificata", list[0] && list[0].title === "Attack on Titan & Co", list[0] && list[0].title);
  check("search: copertina da src e da data-src", list[0] && list[0].imageURL === "https://img.example/aot.jpg" && list[1] && list[1].imageURL === "https://img.example/berserk.jpg");
  const single = await ex.searchResults("berserk");
  check("search: un solo risultato (redirect alla pagina del manga)", single.length === 1 && single[0].id === MANGA_URL && single[0].title === "Berserk", JSON.stringify(single));
  check("search: nessun risultato -> []", (await ex.searchResults("zzzz")).length === 0);
  check("search: sito in manutenzione -> []", (await ex.searchResults("manutenzione")).length === 0);

  // --- Scheda: dettagli + capitoli (un solo download grazie alla cache) ---
  mock = makeMockFetch(pages);
  ex = loadExtractor(FILE, mock.fetchImpl);
  const details = await ex.extractDetails(MANGA_URL);
  const chapters = await ex.extractChapters(MANGA_URL);
  check("details: trama", details.description === "Guts, the Black Swordsman.", details.description);
  check("cache: pagina manga scaricata una sola volta", mock.calls[MANGA_URL] === 1, `${mock.calls[MANGA_URL]} richieste`);
  const entries = chapters["English"] || [];
  const labels = entries.map((e) => e[0]).join(",");
  check("chapters: 6 capitoli, doppioni esclusi", entries.length === 6, `${entries.length}`);
  check("chapters: sotto-capitoli a 2 cifre in ordine (0.2 prima di 0.10) ed extra numerato dall'URL", labels === "0.1,0.2,0.10,0.16,1,18.5", labels);
  check("chapters: id = URL del capitolo", entries[4] && entries[4][1][0].id === CHAPTER_URL);
  check("chapters: campo interno 'label' non esposto", entries.every((e) => !("label" in e[1][0])));

  // --- Immagini ---
  mock = makeMockFetch(pages);
  ex = loadExtractor(FILE, mock.fetchImpl);
  const images = await ex.extractImages(CHAPTER_URL);
  check("images: array thzq", images.length === 2 && images[0] === "https://i1.mangakatana.com/token/aaa/1.jpg", `${images.length}`);
  await ex.extractImages(CHAPTER_URL);
  check("images: pagina capitolo mai in cache (link con token temporanei)", mock.calls[CHAPTER_URL] === 2, `${mock.calls[CHAPTER_URL]} richieste`);
  const fallback = await ex.extractImages(`${MANGA_URL}/c2`);
  check("images: riserva ytaw", fallback.length === 1 && fallback[0].endsWith("/bbb/1.jpg"), `${fallback.length}`);

  await retryChecks(FILE, pages, searchUrl("titan"), (e) => e.searchResults("titan"), 2);
}

// ==========================================
// VORTEX SCANS
// ==========================================
async function runVortex() {
  console.log("\n🧪 Test OFFLINE Vortex Scans\n");
  const FILE = "vortex_extractor_v2.js";
  const BASE = "https://vortexscans.org";
  const searchUrl = `${BASE}/series/?searchTerm=sword`;
  const SERIES_URL = `${BASE}/series/solo-swordmaster`;
  const CHAPTER_URL = `${SERIES_URL}/chapter-1`;

  // Nelle pagine vere i dati sono dentro uno script JS: le sequenze \" ’ \x3C sono scritte per esteso
  // Lo script cerca la copertina da 200 caratteri prima a 500 dopo il titolo: nelle pagine vere ogni
  // serie ha molti altri campi in mezzo, qui riprodotti con un campo lungo (altrimenti prenderebbe
  // la copertina della serie precedente).
  const OTHER_FIELDS = `alternativeTitles:"${"y".repeat(260)}"`;
  const SEARCH_HTML = `<html>${FILLER}<script>data=[{id:1,${OTHER_FIELDS},slug:"the-veteran-swordmaster's-stream",postTitle:"The Veteran Swordmaster\\u2019s \\"Stream\\"",featuredImage:"https://storage.vortexscans.org/upload/cover1.webp"},
{id:2,${OTHER_FIELDS},slug:"solo-swordmaster",postTitle:"Solo Swordmaster",featuredImage:"https://storage.vortexscans.org/upload/cover2.webp"},
{id:2,${OTHER_FIELDS},slug:"solo-swordmaster",postTitle:"Solo Swordmaster",featuredImage:"https://storage.vortexscans.org/upload/cover2.webp"}]</script></html>`;

  const SERIES_HTML = `<html>${FILLER}<script>post={postContent:"\\x3Cp>Una storia &amp; una spada\\x3C/p>",genres:[{name:"Action",color:""},{name:"Fantasy",color:""},{name:"Action",color:""}],
chapters:[{id:3,slug:"chapter-3",number:3,isLocked:!1,price:0},
{id:2,slug:"chapter-2",number:2,title:"Paid",isLocked:!0,price:10},
{id:1,slug:"chapter-1",number:1,title:"Start",isLocked:!1,price:0},
{id:15,slug:"chapter-1.5",number:1.5,isLocked:!1,price:0}]}</script></html>`;

  const READER_HTML = `<html>${FILLER}<script>images=[{url:"https://i0.wp.com/storage.vortexscans.org/upload/series/solo/ch1/2.webp?w=800",order:2},
{url:"https://storage.vortexscans.org/upload/series/solo/ch1/1.webp",order:1},
{url:"https://i1.wp.com/storage.vortexscans.org/upload/series/solo/ch1/2.webp?w=1200",order:3}]</script></html>`;
  const READER_FALLBACK_HTML = `<html>${FILLER}<img src="https://i0.wp.com/storage.vortexscans.org/upload/series/solo/ch3/1.webp">
<img src="https://storage.vortexscans.org/upload/series/solo/ch3/2.jpg"></html>`;

  const pages = {
    [searchUrl]: SEARCH_HTML,
    [SERIES_URL]: SERIES_HTML,
    [CHAPTER_URL]: READER_HTML,
    [`${SERIES_URL}/chapter-3`]: READER_FALLBACK_HTML,
  };

  // --- Ricerca ---
  let mock = makeMockFetch(pages);
  let ex = loadExtractor(FILE, mock.fetchImpl);
  const results = await ex.searchResults("sword");
  check("search: indirizzo con /series/ e slash finale", mock.calls[searchUrl] === 1, Object.keys(mock.calls).join(" "));
  check("search: 2 risultati, senza doppioni", results.length === 2, `${results.length}`);
  check("search: slug con apostrofo", results[0] && results[0].id === `${BASE}/series/the-veteran-swordmaster's-stream`, results[0] && results[0].id);
  check("search: titolo con caratteri escapati", results[0] && results[0].title === 'The Veteran Swordmaster’s "Stream"', results[0] && results[0].title);
  check("search: copertina", results[1] && results[1].imageURL === "https://storage.vortexscans.org/upload/cover2.webp", results[1] && results[1].imageURL);

  // --- Scheda: dettagli + capitoli (un solo download grazie alla cache) ---
  mock = makeMockFetch(pages);
  ex = loadExtractor(FILE, mock.fetchImpl);
  const details = await ex.extractDetails(SERIES_URL);
  const chapters = await ex.extractChapters(SERIES_URL);
  check("details: trama senza tag HTML", details.description === "Una storia & una spada", details.description);
  check("details: generi senza doppioni", Array.from(details.tags).join(",") === "Action,Fantasy", Array.from(details.tags).join(","));
  check("cache: pagina serie scaricata una sola volta", mock.calls[SERIES_URL] === 1, `${mock.calls[SERIES_URL]} richieste`);
  const entries = chapters["English"] || [];
  const labels = entries.map((e) => e[0]).join(",");
  check("chapters: capitolo a pagamento escluso, ordine crescente", labels === "1,1.5,3", labels);
  check("chapters: titolo e id", entries[0] && entries[0][1][0].title === "Chapter 1: Start" && entries[0][1][0].id === CHAPTER_URL,
    entries[0] && `${entries[0][1][0].title} ${entries[0][1][0].id}`);

  // --- Immagini ---
  const images = await ex.extractImages(CHAPTER_URL);
  check("images: ordinate per 'order', link wp.com convertiti in storage diretto, senza doppioni",
    images.join(",") === "https://storage.vortexscans.org/upload/series/solo/ch1/1.webp,https://storage.vortexscans.org/upload/series/solo/ch1/2.webp", images.join(","));
  const fallback = await ex.extractImages(`${SERIES_URL}/chapter-3`);
  check("images: riserva (link nella pagina) con conversione wp.com",
    fallback.join(",") === "https://storage.vortexscans.org/upload/series/solo/ch3/1.webp,https://storage.vortexscans.org/upload/series/solo/ch3/2.jpg", fallback.join(","));

  await retryChecks(FILE, pages, searchUrl, (e) => e.searchResults("sword"), 2);
}

(async () => {
  try {
    await runMangaKatana();
    await runVortex();
  } catch (error) {
    console.error("💥 Errore imprevisto:", error);
    failures++;
  }
  console.log(failures === 0 ? "\n🎉 Tutti i test superati\n" : `\n⚠️  ${failures} test falliti\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
