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
        const res = await soraFetch(`${BASE_URL}/manga?search=${encodeURIComponent(keyword)}&search_by=book_name`, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return [];
        const html = await res.text();
        if (!html) return [];


        const seen = new Set();
        const hrefImgRegex = /href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">\s*<img data-src="([^"]+)"/g;
        const titleRegex = /<h3 class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/g;
        const imgs = {};
        const titles = {};
        const hrefs = [];
        let m;

        while ((m = hrefImgRegex.exec(html)) !== null) {
            const u = m[1];
            if (!imgs[u]) { imgs[u] = m[2]; hrefs.push(u); }
        }
        while ((m = titleRegex.exec(html)) !== null) {
            titles[m[1]] = m[2];
        }
        const kw = keyword.toLowerCase().trim();
        const allResults = [];
        for (const u of hrefs) {
            if (titles[u] && !seen.has(u)) {
                seen.add(u);
                allResults.push({ id: u, title: titles[u].trim(), imageURL: imgs[u] });
            }
        }
        // Filtra: mostra solo titoli che contengono la keyword
        const filtered = allResults.filter(function(r) { return r.title.toLowerCase().indexOf(kw) !== -1; });
        const results = filtered.length > 0 ? filtered : allResults;

        console.log(`[MangaKatana][Search] ${results.length} results`);
        return results;
    } catch (e) {
        console.log(`[MangaKatana][Search] ${e}`);
        return [];
    }
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
// 3. CHAPTERS -> { "label": [ [numStr, [{id,title,chapter,scanlation_group}]], ... ] }
// ==========================================

async function extractChapters(urlOrId) {
    console.log(`[MangaKatana][Chapters] ${urlOrId}`);
    try {
        const res = await soraFetch(urlOrId, { headers: HEADERS });
        if (!res || typeof res.text !== "function") return {};
        const html = await res.text();
        if (!html) return {};

        const chapterRegex = /<div class="chapter">\s*<a href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">([^<]+)<\/a>/g;
        const chapters = [];
        const seen = new Set();
        let match;

        while ((match = chapterRegex.exec(html)) !== null) {
            const id = match[1].trim();
            const rawTitle = match[2].trim();
            if (!seen.has(id)) {
                seen.add(id);
                const numMatch = rawTitle.match(/Chapter\s+([\d.]+)/i);
                const number = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
                chapters.push({
                    id: id,
                    title: rawTitle,
                    chapter: number,
                    scanlation_group: "MangaKatana"
                });
            }
        }

        chapters.sort(function(a, b) { return a.chapter - b.chapter; });

        const entries = chapters.map(function(ch) {
            return [String(ch.chapter), [ch]];
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

        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            try {
                const pages = JSON.parse(thzqMatch[1]);
                console.log(`[MangaKatana][Images] ${pages.length} pages`);
                return pages;
            } catch (_) {}
        }

        const ytawMatch = html.match(/var ytaw\s*=\s*(\[[\s\S]*?\]);/);
        if (ytawMatch) {
            try {
                const pages = JSON.parse(ytawMatch[1]);
                console.log(`[MangaKatana][Images] ${pages.length} pages`);
                return pages;
            } catch (_) {}
        }

        return [];
    } catch (e) {
        console.log(`[MangaKatana][Images] ${e}`);
        return [];
    }
}

// ==========================================
// SORA FETCH
// ==========================================

[object Promise][object Promise]