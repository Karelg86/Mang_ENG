// ==========================================
// 📖 MODULE SORA — MANGAKATANA ENG (mangakatana.com)
// Type: mangas. Conforme spec Sora/Luna/Shirox.
// ==========================================

const BASE_URL = "https://mangakatana.com";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": `${BASE_URL}/`
};

// ==========================================
// 1. RICERCA -> [{ id, title, imageURL }]
// ==========================================

async function searchResults(keyword, page) {
    console.log(`[MangaKatana][Search] "${keyword}"`);
    try {
        const searchUrl = `${BASE_URL}/?search=${encodeURIComponent(keyword)}&search_by=m_name`;
        const res = await soraFetch(searchUrl, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];

        const listStart = html.indexOf('id="book_list"');
        if (listStart === -1) {
            // Un solo risultato: MangaKatana reindirizza direttamente alla pagina del manga.
            const mCanon = html.match(/<link rel="canonical" href="([^"]*\/manga\/[^"]+)"/);
            const mTitle = html.match(/<h1 class="heading">([^<]+)/);
            if (!mCanon || !mTitle) return [];
            const mCover = html.match(/<meta property="og:image" content="([^"]+)"/);
            return [{ id: mCanon[1].trim(), title: decodeEntities(mTitle[1].trim()), imageURL: mCover ? mCover[1].trim() : "" }];
        }
        // Solo la lista risultati: dopo col_right ci sono i widget ("hot_book")
        // con lo stesso markup, che finivano tra i risultati.
        const listEnd = html.indexOf('id="col_right"', listStart);
        const bookList = html.slice(listStart, listEnd !== -1 ? listEnd : undefined);
        const items = bookList.split('<div class="item"');
        const results = [];
        const seen = new Set();

        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            const mTitle = item.match(/<h3 class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
            if (!mTitle) continue;

            const id = mTitle[1].trim();
            const title = decodeEntities(mTitle[2].trim());

            if (seen.has(id)) continue;
            seen.add(id);

            let img = "";
            const mImg = item.match(/<(?:img|source)[^>]+(?:data-src|srcset|src)="([^"]+)"/);
            if (mImg) {
                img = mImg[1].trim();
            }

            results.push({ id: id, title: title, imageURL: img });
        }

        // Nessun filtro sul titolo: il sito trova anche per titolo alternativo
        // (es. "shingeki no kyojin" -> "Attack on Titan").
        console.log(`[MangaKatana][Search] ${results.length} results`);
        return results;
    } catch (e) {
        console.log(`[MangaKatana][Search] ${e}`);
        return [];
    }
}

function decodeEntities(str) {
    return str
        .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); })
        .replace(/&#x([0-9a-f]+);/gi, function(_, n) { return String.fromCharCode(parseInt(n, 16)); })
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// ==========================================
// 2. DETAILS -> { description, tags }
// ==========================================

async function extractDetails(id) {
    console.log(`[MangaKatana][Details] ${id}`);
    try {
        const res = await soraFetch(id, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return { description: "Not available", tags: [] };
        const html = await res.text();
        if (!html) return { description: "Not available", tags: [] };

        let description = "No description available.";
        const descMatch = html.match(/<div class="summary">\s*<p>([^<]+)<\/p>/);
        if (descMatch) {
            description = descMatch[1].trim();
        } else {
            const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
            if (metaMatch) description = metaMatch[1].replace(/&amp;/g, '&').trim();
        }
        return { description, tags: [] };
    } catch (e) {
        console.log(`[MangaKatana][Details] ${e}`);
        return { description: "Error loading description", tags: [] };
    }
}

// ==========================================
// 3. CHAPTERS -> { "English": [ [numStr, [{id,title,chapter,scanlation_group}]], ... ] }
// ==========================================

async function extractChapters(urlOrId) {
    console.log(`[MangaKatana][Chapters] ${urlOrId}`);
    try {
        const res = await soraFetch(urlOrId, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return {};
        const html = await res.text();
        if (!html) return {};

        const chSectionMatch = html.match(/<div class="chapters">([\s\S]*?)<\/table>/);
        const chHtml = chSectionMatch ? chSectionMatch[1] : html;

        const chapterRegex = /<div class="chapter">\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        const chapters = [];
        const seen = new Set();
        let match;

        while ((match = chapterRegex.exec(chHtml)) !== null) {
            const id = match[1].trim();
            const rawTitle = match[2].trim();
            if (!seen.has(id)) {
                seen.add(id);
                // Titolo, altrimenti l'URL (/c18.5): gli extra "Vol.5 Side Story…" non hanno "Chapter N"
                const numMatch = rawTitle.match(/Chapter\s+(\d+(?:\.\d+)?)/i) || id.match(/\/c(\d+(?:\.\d+)?)\/?$/);
                const label = numMatch ? numMatch[1] : String(chapters.length + 1);
                chapters.push({
                    id: id,
                    title: rawTitle,
                    chapter: parseFloat(label),
                    scanlation_group: "MangaKatana",
                    label: label
                });
            }
        }

        // Sotto-capitoli numerati 0.1 … 0.16 (prologo di Berserk): "0.10" non è 0.1.
        // Se il manga usa decimali a 2+ cifre, la parte dopo il punto è un indice intero.
        if (chapters.some(function(ch) { return /\.\d{2,}$/.test(ch.label); })) {
            chapters.forEach(function(ch) {
                const parts = ch.label.split('.');
                if (parts.length === 2) ch.chapter = parseInt(parts[0], 10) + parseInt(parts[1], 10) / 1000;
            });
        }

        chapters.sort(function(a, b) { return a.chapter - b.chapter; });
        const entries = chapters.map(function(ch) {
            const label = ch.label;
            delete ch.label;
            return [label, [ch]];
        });
        console.log(`[MangaKatana][Chapters] ${entries.length} chapters found`);
        return { "English": entries };
    } catch (e) {
        console.log(`[MangaKatana][Chapters] ${e}`);
        return {};
    }
}

// ==========================================
// 4. IMAGES -> [ "url", ... ]
// ==========================================

async function extractImages(chapterId) {
    console.log(`[MangaKatana][Images] ${chapterId}`);
    try {
        const res = await soraFetch(chapterId, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];

        let pages = [];
        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            const matches = thzqMatch[1].match(/https:\/\/[^'"]+/g);
            if (matches && matches.length > 0) pages = matches;
        }

        if (pages.length === 0) {
            const ytawMatch = html.match(/var ytaw\s*=\s*(\[[\s\S]*?\]);/);
            if (ytawMatch) {
                const matches = ytawMatch[1].match(/https:\/\/[^'"]+/g);
                if (matches && matches.length > 0) pages = matches;
            }
        }

        console.log(`[MangaKatana][Images] ${pages.length} pages found`);
        return pages;
    } catch (e) {
        console.log(`[MangaKatana][Images] ${e}`);
        return [];
    }
}

// ==========================================
// SORA FETCH
// ==========================================

// Rete debole (4G/E): una richiesta fallita o con errore del server viene ritentata,
// invece di arrivare a Shirox come lista vuota ("No pages found") al primo errore.
// Il limite di tempo resta sotto i 120 s che Shirox concede a ogni funzione del modulo.
const FETCH_ATTEMPTS = 3;
const FETCH_TIME_BUDGET_MS = 50000;

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const started = Date.now();
    let res = null;
    for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
        res = await soraFetchOnce(url, options);
        if (res && !(res.status >= 500 || res.status === 429 || res.status === 408)) return res;
        if (attempt === FETCH_ATTEMPTS || Date.now() - started > FETCH_TIME_BUDGET_MS) break;
        console.log(`[soraFetch] tentativo ${attempt} fallito (${res ? res.status : 'rete'}), riprovo: ${url}`);
        await sleep(1000 * attempt);
    }
    return res;
}

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function soraFetchOnce(url, options) {
    const headers = options.headers || {};
    if (!headers["User-Agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }
    try {
        if (typeof fetchv2 !== 'undefined') {
            return await fetchv2(url, headers, options.method ?? 'GET', options.body ?? null, true, 'utf-8');
        }
        return await fetch(url, options);
    } catch (e) {
        try { return await fetch(url, options); } catch (error) { return null; }
    }
}
