// ==========================================
// 📖 MODULE SORA — VORTEX SCANS (vortexscans.org)
// Type: mangas. Conforme spec Sora/Luna/Shirox.
// ==========================================

const BASE_URL = "https://vortexscans.org";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": `${BASE_URL}/`
};

// ==========================================
// 1. RICERCA -> [{ id, title, imageURL }]
// ==========================================

async function searchResults(keyword, page) {
    const rawKw = keyword ? String(keyword).trim() : "";
    console.log(`[VortexScans][Search] "${rawKw}"`);
    try {
        // NOTA: Lo slash finale in /series/ è OBBLIGATORIO per evitare redirect 301 insicuri verso http://
        const url = rawKw.length > 0 
            ? `${BASE_URL}/series/?searchTerm=${encodeURIComponent(rawKw)}`
            : `${BASE_URL}/series/`;

        const res = await soraFetch(url, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];

        const results = [];
        const seen = new Set();

        // Gli slug possono contenere apostrofi (the-veteran-swordmaster's-stream)
        // e i titoli caratteri escapati (\" ’): stringhe JS lette per intero.
        const regex = /slug:"((?:[^"\\]|\\.)+)",postTitle:"((?:[^"\\]|\\.)+)"/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            const slug = unescapeJs(m[1]);
            const title = unescapeJs(m[2]).trim();
            if (seen.has(slug)) continue;
            seen.add(slug);

            const slice = html.substring(Math.max(0, m.index - 200), Math.min(html.length, m.index + 500));
            const imgMatch = slice.match(/featuredImage:"([^"]+)"/);
            const img = imgMatch ? imgMatch[1].trim() : "";

            results.push({
                id: `${BASE_URL}/series/${slug}`,
                title: title,
                imageURL: img
            });
        }

        console.log(`[VortexScans][Search] ${results.length} results found`);
        return results;
    } catch (e) {
        console.log(`[VortexScans][Search] ${e}`);
        return [];
    }
}

function unescapeJs(str) {
    try { return JSON.parse('"' + str.replace(/\\x([0-9a-f]{2})/gi, '\\u00$1') + '"'); }
    catch (e) { return str; }
}

// ==========================================
// 2. DETTAGLI -> { description, tags }
// ==========================================

async function extractDetails(id) {
    console.log(`[VortexScans][Details] ${id}`);
    try {
        const fullUrl = id.startsWith("http") ? id : `${BASE_URL}/series/${id}`;
        const html = await fetchHtmlCached(fullUrl, HEADERS);
        if (!html) return { description: "Not available", tags: [] };

        let description = "No description available.";
        const postContentMatch = html.match(/postContent:"([^"]+)"/);
        if (postContentMatch) {
            description = postContentMatch[1]
                .replace(/\\x3C/g, '<')
                .replace(/<[^>]+>/g, '')
                .replace(/\\n/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
        } else {
            const metaMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/);
            if (metaMatch) description = metaMatch[1].trim();
        }

        const genreMatches = [...html.matchAll(/name:"([A-Za-z0-9\s\-]+)",color:""/g)].map(m => m[1].trim());
        const tags = [...new Set(genreMatches)];

        return { description, tags };
    } catch (e) {
        console.log(`[VortexScans][Details] ${e}`);
        return { description: "Error loading description", tags: [] };
    }
}

// ==========================================
// 3. CAPITOLI -> { "English": [ [numStr, [{id,title,chapter,scanlation_group}]], ... ] }
// ==========================================

async function extractChapters(urlOrId) {
    console.log(`[VortexScans][Chapters] ${urlOrId}`);
    try {
        const fullUrl = urlOrId.startsWith("http") ? urlOrId : `${BASE_URL}/series/${urlOrId}`;
        const html = await fetchHtmlCached(fullUrl, HEADERS);
        if (!html) return {};

        const seriesSlugMatch = fullUrl.match(/\/series\/([^\/\?#]+)/);
        const seriesSlug = seriesSlugMatch ? seriesSlugMatch[1] : "";

        const chapters = [];
        const seen = new Set();

        const jsonRegex = /slug:"(chapter-[^"]+)",number:([0-9.]+)(?:,title:"([^"]*)")?/g;
        let m;
        while ((m = jsonRegex.exec(html)) !== null) {
            const chapSlug = m[1];
            const num = parseFloat(m[2]);
            const extraTitle = m[3] ? m[3].trim() : "";
            // Capitoli a pagamento (coins): aperti mostrano solo l'immagine "bloccato"
            const nextChap = html.indexOf('slug:"chapter-', m.index + 1);
            const fields = html.substring(m.index, nextChap !== -1 ? Math.min(nextChap, m.index + 1500) : m.index + 1500);
            if (/isLocked:!0/.test(fields)) continue;
            if (!seen.has(chapSlug)) {
                seen.add(chapSlug);
                const title = extraTitle ? `Chapter ${num}: ${extraTitle}` : `Chapter ${num}`;
                chapters.push({
                    id: `${BASE_URL}/series/${seriesSlug}/${chapSlug}`,
                    title: title,
                    chapter: num,
                    scanlation_group: "Vortex Scans"
                });
            }
        }

        if (chapters.length === 0) {
            const htmlRegex = /href="(\/series\/[^"\/]+\/(chapter-[^"\/]+))"[^>]*>([\s\S]*?)<\/a>/g;
            while ((m = htmlRegex.exec(html)) !== null) {
                const fullPath = m[1];
                const chapSlug = m[2];
                const linkText = m[3].replace(/<[^>]+>/g, '').replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ').trim();
                if (!seen.has(chapSlug)) {
                    seen.add(chapSlug);
                    const numMatch = chapSlug.match(/chapter-([0-9.]+)/i);
                    const num = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
                    chapters.push({
                        id: `${BASE_URL}${fullPath}`,
                        title: linkText || `Chapter ${num}`,
                        chapter: num,
                        scanlation_group: "Vortex Scans"
                    });
                }
            }
        }

        chapters.sort((a, b) => a.chapter - b.chapter);
        const entries = chapters.map(ch => [String(ch.chapter), [ch]]);
        console.log(`[VortexScans][Chapters] ${entries.length} chapters found`);
        return { "English": entries };
    } catch (e) {
        console.log(`[VortexScans][Chapters] ${e}`);
        return {};
    }
}

// ==========================================
// 4. IMMAGINI -> [ "url", ... ]
// ==========================================

async function extractImages(chapterId) {
    console.log(`[VortexScans][Images] ${chapterId}`);
    try {
        const fullUrl = chapterId.startsWith("http") ? chapterId : `${BASE_URL}${chapterId}`;
        const res = await soraFetch(fullUrl, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];

        let pages = [];

        const orderRegex = /url:"(https:\/\/[^"]+)",order:(\d+)/g;
        const orderPages = [];
        let m;
        while ((m = orderRegex.exec(html)) !== null) {
            orderPages.push({ url: m[1], order: parseInt(m[2], 10) });
        }

        if (orderPages.length > 0) {
            orderPages.sort((a, b) => a.order - b.order);
            const seen = new Set();
            for (const p of orderPages) {
                const url = directImageUrl(p.url);
                if (!seen.has(url)) {
                    seen.add(url);
                    pages.push(url);
                }
            }
        }

        if (pages.length === 0) {
            const rawImgs = [...new Set([...html.matchAll(/https?:\/\/(?:storage\.vortexscans\.org|i\d\.wp\.com\/storage\.vortexscans\.org)\/upload\/series\/[^\s"'<>]+\.(?:webp|png|jpg|jpeg)/gi)].map(m => directImageUrl(m[0])))];
            pages = rawImgs;
        }

        console.log(`[VortexScans][Images] ${pages.length} pages found`);
        return pages;
    } catch (e) {
        console.log(`[VortexScans][Images] ${e}`);
        return [];
    }
}

// Il proxy WordPress Photon (i0.wp.com) ricodifica ogni immagine prima di servirla:
// lo storage diretto è più veloce e leggero (WebP originale, cache Cloudflare).
function directImageUrl(url) {
    const m = url.match(/^https?:\/\/i\d\.wp\.com\/(storage\.vortexscans\.org\/[^?#]+)/i);
    return m ? `https://${m[1]}` : url;
}

// ==========================================
// CACHE HTML
// ==========================================

// Shirox apre la scheda chiamando extractDetails e poi extractChapters sulla stessa
// pagina: la seconda chiamata la legge da qui invece di riscaricarla. Il contesto JS
// resta vivo finché il modulo è attivo; si salvano solo pagine complete (niente
// errori, manutenzione o sfide Cloudflare).
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
// SORA FETCH HELPER
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
