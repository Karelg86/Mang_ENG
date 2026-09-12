const _pageCache = new Map();

async function _fetchPage(url) {
    if (_pageCache.has(url)) return _pageCache.get(url);
    const res = await soraFetch(url);
    if (!res) return '';
    const text = await res.text();
    _pageCache.set(url, text);
    return text;
}

async function searchResults(keyword) {
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
                results.push({ title: titles[u].trim(), href: u, image: imgs[u] });
            }
        }

        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([]);
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

        return JSON.stringify([{ description, aliases: '', airdate: '' }]);
    } catch (e) {
        return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
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
            const href = match[1].trim();
            const rawTitle = match[2].trim();
            if (!seen.has(href)) {
                seen.add(href);
                const numMatch = rawTitle.match(/Chapter\s+([\d.]+)/i);
                const number = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
                chapters.push({ href, title: rawTitle, number });
            }
        }

        chapters.reverse();
        return JSON.stringify(chapters);
    } catch (e) {
        return JSON.stringify([]);
    }
}

// TRAPPOLA PER LA CACHE
async function extractEpisodes(url) {
    return JSON.stringify([{
        id: "error_cache",
        title: "❌ ERRORE: CACHE DELL'APP. Rimuovi modulo e usa il nuovo link mangeng.json!",
        number: 1
    }]);
}

async function extractStreamUrl(url) {
    return "error";
}

async function extractText(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();

        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            try {
                const pages = JSON.parse(thzqMatch[1]);
                if (pages && pages.length > 0) {
                    return pages.map(function(src) { return "<img src='" + src + "' style='max-width:100%;height:auto;display:block;margin:0 auto;'/>"; }).join('<br/>');
                }
            } catch (_) {}
        }

        const ytawMatch = html.match(/var ytaw\s*=\s*(\[[\s\S]*?\]);/);
        if (ytawMatch) {
            try {
                const pages = JSON.parse(ytawMatch[1]);
                if (pages && pages.length > 0) {
                    return pages.map(function(src) { return "<img src='" + src + "' style='max-width:100%;height:auto;display:block;margin:0 auto;'/>"; }).join('<br/>');
                }
            } catch (_) {}
        }

        return 'Nessun contenuto trovato.';
    } catch (e) {
        return 'Errore estrazione contenuto.';
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        const response = await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
        if (response && response.status !== undefined) return response;
        throw new Error('fetchv2 returned error format');
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

// NUOVO CONTRATTO MANGA
async function extractImages(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();
        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            try {
                return thzqMatch[1]; // È già un array JSON di stringhe!
            } catch (_) {}
        }
        return JSON.stringify([]);
    } catch (e) {
        return JSON.stringify([]);
    }
}
