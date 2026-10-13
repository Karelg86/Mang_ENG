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
        const res = await soraFetch(fullUrl, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return { description: "Not available", tags: [] };
        const html = await res.text();
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
        const res = await soraFetch(fullUrl, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return {};
        const html = await res.text();
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
                if (!seen.has(p.url)) {
                    seen.add(p.url);
                    pages.push(p.url);
                }
            }
        }

        if (pages.length === 0) {
            const rawImgs = [...new Set([...html.matchAll(/https?:\/\/(?:storage\.vortexscans\.org|i\d\.wp\.com\/storage\.vortexscans\.org)\/upload\/series\/[^\s"'<>]+\.(?:webp|png|jpg|jpeg)/gi)].map(m => m[0]))];
            pages = rawImgs.map(u => u.replace(/^https?:\/\/i\d\.wp\.com\//, 'https://'));
        }

        console.log(`[VortexScans][Images] ${pages.length} pages found`);
        return pages;
    } catch (e) {
        console.log(`[VortexScans][Images] ${e}`);
        return [];
    }
}

// ==========================================
// SORA FETCH HELPER
// ==========================================

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
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
