const _pageCache = new Map();

async function _fetchPage(url) {
    if (_pageCache.has(url)) return _pageCache.get(url);
    const res = await soraFetch(url);
    if (!res) return '';
    const text = await res.text();
    _pageCache.set(url, text);
    return text;
}

// FORMATO MANGA KANZEN
async function searchResults(keyword, page = 0) {
    try {
        const response = await soraFetch(`https://mangakatana.com/manga?search=${encodeURIComponent(keyword)}&search_by=book_name`);
        const html = await response.text();
        const results = [];
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
        for (const u of hrefs) {
            if (titles[u] && !seen.has(u)) {
                seen.add(u);
                // Usa 'id' e 'imageURL'
                results.push({ id: u, title: titles[u].trim(), imageURL: imgs[u] });
            }
        }

        return results; // ARRAY nativo
    } catch (e) {
        return [];
    }
}

async function extractDetails(url) {
    try {
        const html = await _fetchPage(url);
        let description = '';
        const descMatch = html.match(/<div class="summary">\s*<p>([^<]+)<\/p>/);
        if (descMatch) {
            description = descMatch[1].trim();
        } else {
            const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
            if (metaMatch) description = metaMatch[1].replace(/&amp;/g, '&').trim();
        }
        return { description: description || 'No description available', tags: [] };
    } catch (e) {
        return { description: 'Error loading description', tags: [] };
    }
}

async function extractChapters(url) {
    try {
        const html = await _fetchPage(url);
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
                chapters.push({ id: id, title: rawTitle, chapter: number, scanlation_group: "MangaKatana" });
            }
        }
        
        chapters.sort(function(a, b) { return a.chapter - b.chapter; });

        const results = chapters.map(function(ch) {
            return [
                String(ch.chapter),
                [ch]
            ];
        });

        return { en: results };
    } catch (e) {
        return { en: [] };
    }
}

async function extractImages(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();
        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            try { return JSON.parse(thzqMatch[1]); } catch (_) {}
        }
        const ytawMatch = html.match(/var ytaw\s*=\s*(\[[\s\S]*?\]);/);
        if (ytawMatch) {
            try { return JSON.parse(ytawMatch[1]); } catch (_) {}
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        const response = await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
        if (response && response.status !== undefined) return response;
        throw new Error('fetchv2 returned error format');
    } catch (e) {
        try { return await fetch(url, options); } catch (error) { return null; }
    }
}
