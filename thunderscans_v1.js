// ==========================================
// 📖 MODULE SORA — THUNDERSCANS EN (en-thunderscans.com)
// Type: mangas. Conforme spec Sora/Luna/Shirox.
// Tema WordPress "mangareader": HTML normale, immagini nello script ts_reader.run({...}).
// ==========================================

const BASE_URL = "https://en-thunderscans.com";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": `${BASE_URL}/`
};

// ==========================================
// 1. RICERCA -> [{ id, title, imageURL }]
// ==========================================

async function searchResults(keyword, page) {
    const rawKw = keyword ? String(keyword).trim() : "";
    console.log(`[Thunderscans][Search] "${rawKw}"`);
    try {
        const url = rawKw.length > 0
            ? `${BASE_URL}/?s=${encodeURIComponent(rawKw)}`
            : `${BASE_URL}/comics/`;
        const res = await soraFetch(url, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];

        // Solo la lista risultati: nessun risultato = pagina senza blocchi "bsx".
        const listStart = html.indexOf('class="listupd"');
        if (listStart === -1) return [];
        let listEnd = html.indexOf('class="pagination"', listStart);
        if (listEnd === -1) listEnd = html.indexOf('id="sidebar"', listStart);
        const list = html.slice(listStart, listEnd !== -1 ? listEnd : undefined);

        const items = list.split('<div class="bsx">');
        const results = [];
        const seen = new Set();

        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            const mHref = item.match(/<a\s+href="([^"]+)"/);
            if (!mHref) continue;
            const id = mHref[1].trim();
            if (id.indexOf("/comics/") === -1) continue;
            if (seen.has(id)) continue;

            const mTitle = item.match(/<a[^>]*\stitle="([^"]*)"/) || item.match(/<div class="tt">\s*([^<]+?)\s*<\/div>/);
            if (!mTitle) continue;
            seen.add(id);

            const mImg = item.match(/<img[^>]+(?:data-src|src)="([^"]+)"/);
            results.push({
                id: id,
                title: decodeEntities(mTitle[1].trim()),
                imageURL: mImg ? mImg[1].trim() : ""
            });
        }

        console.log(`[Thunderscans][Search] ${results.length} results`);
        return results;
    } catch (e) {
        console.log(`[Thunderscans][Search] ${e}`);
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
// 2. DETTAGLI -> { description, tags }
// ==========================================

async function extractDetails(id) {
    console.log(`[Thunderscans][Details] ${id}`);
    try {
        const html = await fetchHtmlCached(id, HEADERS);
        if (!html) return { description: "Not available", tags: [] };

        let description = "No description available.";
        const mDesc = html.match(/itemprop="description">\s*([\s\S]*?)\s*<\/div>/);
        if (mDesc) {
            const text = decodeEntities(
                mDesc[1]
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
                    .replace(/<[^>]+>/g, "")
            ).trim();
            if (text) description = text;
        } else {
            const mMeta = html.match(/<meta property="og:description" content="([^"]+)"/);
            if (mMeta) description = decodeEntities(mMeta[1]).trim();
        }

        const genreRegex = /<a href="https:\/\/en-thunderscans\.com\/genres\/[^"]*"[^>]*>([^<]+)<\/a>/g;
        const tags = [];
        let m;
        while ((m = genreRegex.exec(html)) !== null) {
            const tag = decodeEntities(m[1].trim());
            if (tag && tags.indexOf(tag) === -1) tags.push(tag);
        }

        return { description, tags };
    } catch (e) {
        console.log(`[Thunderscans][Details] ${e}`);
        return { description: "Error loading description", tags: [] };
    }
}

// ==========================================
// 3. CAPITOLI -> { "English": [ [numStr, [{id,title,chapter,scanlation_group}]], ... ] }
// ==========================================

async function extractChapters(urlOrId) {
    console.log(`[Thunderscans][Chapters] ${urlOrId}`);
    try {
        const html = await fetchHtmlCached(urlOrId, HEADERS);
        if (!html) return {};

        const start = html.indexOf('id="chapterlist"');
        if (start === -1) return {};
        const section = html.slice(start);
        const ulStart = section.indexOf("<ul");
        const ulEnd = ulStart !== -1 ? section.indexOf("</ul>", ulStart) : -1;
        if (ulStart === -1 || ulEnd === -1) return {};
        const listHtml = section.slice(ulStart, ulEnd);

        const liRegex = /<li data-num="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g;
        const chapters = [];
        const seen = new Set();
        let m;

        while ((m = liRegex.exec(listHtml)) !== null) {
            const label = m[1].trim();
            const inner = m[2];
            const mHref = inner.match(/<a\s+href="([^"]+)"/);
            if (!mHref) continue;
            // Capitoli a pagamento (coins/premium): non verificato su capitoli reali, cautela
            if (/lock|premium|coin/i.test(inner)) continue;

            const id = mHref[1].trim();
            if (seen.has(id)) continue;
            seen.add(id);

            const num = parseFloat(label);
            chapters.push({
                id: id,
                title: `Chapter ${label}`,
                chapter: isNaN(num) ? chapters.length + 1 : num,
                scanlation_group: "Thunderscans",
                label: label
            });
        }

        chapters.sort(function(a, b) { return a.chapter - b.chapter; });
        const entries = chapters.map(function(ch) {
            const label = ch.label;
            delete ch.label;
            return [label, [ch]];
        });
        console.log(`[Thunderscans][Chapters] ${entries.length} chapters found`);
        return { "English": entries };
    } catch (e) {
        console.log(`[Thunderscans][Chapters] ${e}`);
        return {};
    }
}

// ==========================================
// 4. IMMAGINI -> [ "url", ... ]
// ==========================================

async function extractImages(chapterId) {
    console.log(`[Thunderscans][Images] ${chapterId}`);
    try {
        // Pagina capitolo mai in cache: niente cache qui.
        const res = await soraFetch(chapterId, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];

        let images = [];
        const reader = extractReaderJson(html);
        if (reader) {
            if (reader.protected === true) {
                console.log("[Thunderscans][Images] capitolo protetto (a pagamento)");
                return [];
            }
            const sources = Array.isArray(reader.sources) ? reader.sources : [];
            const source = sources.find(function(s) { return s && s.source === reader.defaultSource; }) || sources[0];
            if (source && Array.isArray(source.images)) images = source.images;
        } else {
            // Riserva: elenco "images":[...] letto direttamente dal testo
            const mImgs = html.match(/"images":\s*(\[[^\]]*\])/);
            if (mImgs) {
                try { images = JSON.parse(mImgs[1]); } catch (e) { images = []; }
            }
        }

        const pages = [];
        const seen = new Set();
        images.forEach(function(u) {
            if (typeof u !== "string" || !/^https?:\/\//i.test(u)) return;
            if (seen.has(u)) return;
            seen.add(u);
            pages.push(u);
        });

        console.log(`[Thunderscans][Images] ${pages.length} pages found`);
        return pages;
    } catch (e) {
        console.log(`[Thunderscans][Images] ${e}`);
        return [];
    }
}

// Legge l'oggetto JSON passato a ts_reader.run({...}) contando le graffe (le stringhe
// con "}" dentro non lo rompono).
function extractReaderJson(html) {
    const i = html.indexOf("ts_reader.run(");
    if (i === -1) return null;
    const start = html.indexOf("{", i);
    if (start === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for (let k = start; k < html.length; k++) {
        const c = html[k];
        if (inStr) {
            if (esc) esc = false;
            else if (c === "\\") esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) {
                try { return JSON.parse(html.slice(start, k + 1)); } catch (e) { return null; }
            }
        }
    }
    return null;
}

// ==========================================
// CACHE HTML
// ==========================================

// Shirox apre la scheda chiamando extractDetails e poi extractChapters sulla stessa
// pagina: la seconda chiamata la legge da qui invece di riscaricarla. Il contesto JS
// resta vivo finché il modulo è attivo; si salvano solo pagine complete (niente
// errori o sfide Cloudflare). Le pagine dei capitoli non passano da qui.
const HTML_CACHE_TTL_MS = 5 * 60 * 1000;
const HTML_CACHE_MAX = 20;
const htmlCache = new Map();
const htmlInFlight = new Map();

async function fetchHtmlCached(url, headers) {
    const hit = htmlCache.get(url);
    if (hit && Date.now() - hit.time < HTML_CACHE_TTL_MS) {
        console.log(`[Cache] hit ${url}`);
        return hit.html;
    }
    if (hit) htmlCache.delete(url);
    if (htmlInFlight.has(url)) return htmlInFlight.get(url);

    const request = (async function() {
        const res = await soraFetch(url, { headers: headers });
        if (!res || typeof res.text !== "function") return null;
        const html = await res.text();
        if (isCacheableHtml(res, html)) {
            if (htmlCache.size >= HTML_CACHE_MAX) htmlCache.delete(htmlCache.keys().next().value);
            htmlCache.set(url, { html: html, time: Date.now() });
        }
        return html;
    })();
    htmlInFlight.set(url, request);
    try { return await request; } finally { htmlInFlight.delete(url); }
}

function isCacheableHtml(res, html) {
    if (!html || html.length < 1000) return false;
    if (res.status && (res.status < 200 || res.status >= 300)) return false;
    return !/_cf_chl_opt|<title>Just a moment/i.test(html);
}

// ==========================================
// SORA FETCH
// ==========================================

// Rete debole (4G/E): una richiesta fallita o con errore del server viene ritentata,
// invece di arrivare a Shirox come lista vuota al primo errore.
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
