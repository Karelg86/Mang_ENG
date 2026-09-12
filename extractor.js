// MangaKatana ENG — modulo manga per Sora/Luna/Shirox
// Funzioni: searchResults, extractDetails, extractChapters, extractText
// Pattern verificati sul sito mangakatana.com in data 2026-09-12
//
// Struttura HTML verificata:
// SEARCH: <div class="wrap_img"><a href="URL"><img data-src="IMG_URL"></a></div>
//         <h3 class="title"><a href="URL">Titolo</a></h3>
// CHAPTERS: <div class="chapter"><a href="URL">Chapter N</a></div>
// PAGES: var thzq=['url1','url2',...]; (array JS inline nella pagina capitolo)

async function searchResults(keyword) {
    try {
        const response = await soraFetch(
            `https://mangakatana.com/manga?search=${encodeURIComponent(keyword)}&search_by=book_name`
        );
        if (!response) return JSON.stringify([]);
        const html = await response.text();
        const results = [];
        const seen = new Set();

        // Pattern: wrap_img con link + img data-src, seguito da h3.title con link e titolo
        // Struttura: <a href="MANGA_URL"><img data-src="IMG_URL"></a> ... <h3 class="title"><a href="MANGA_URL">TITOLO</a></h3>
        const blockRegex = /<div class="wrap_img">\s*<a href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">\s*<img data-src="([^"]+)"[^>]*>\s*<\/a>\s*<\/div>[\s\S]*?<h3 class="title">\s*<a href="[^"]+">([^<]+)<\/a>/g;
        let match;
        while ((match = blockRegex.exec(html)) !== null) {
            const href = match[1].trim();
            if (!seen.has(href)) {
                seen.add(href);
                results.push({
                    title: match[3].trim(),
                    href: href,
                    image: match[2].trim()
                });
            }
        }

        // Fallback più semplice se il regex multi-line non cattura nulla
        if (results.length === 0) {
            const hrefImgRegex = /href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">\s*<img data-src="([^"]+)"/g;
            const titleRegex = /<h3 class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/g;
            const hrefs = [];
            const imgs = {};
            const titles = {};
            let m;
            while ((m = hrefImgRegex.exec(html)) !== null) {
                const url = m[1];
                if (!imgs[url]) { imgs[url] = m[2]; hrefs.push(url); }
            }
            while ((m = titleRegex.exec(html)) !== null) {
                titles[m[1]] = m[2];
            }
            for (const url of hrefs) {
                if (titles[url] && !seen.has(url)) {
                    seen.add(url);
                    results.push({ title: titles[url].trim(), href: url, image: imgs[url] });
                }
            }
        }

        return JSON.stringify(results);
    } catch (e) {
        console.log('searchResults error:', e);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
        const html = await response.text();

        // Descrizione: <div class="summary"><p>...</p></div>
        let description = '';
        const descMatch = html.match(/<div class="summary">\s*<p>([^<]+(?:<(?!\/p)[^>]+>[^<]*)*)<\/p>/);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, '').trim();
        }
        // Fallback meta description
        if (!description) {
            const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
            if (metaMatch) description = metaMatch[1].replace(/&amp;/g, '&').trim();
        }

        // Alt names
        let aliases = '';
        const altMatch = html.match(/Alternative[^<]*<\/[^>]+>\s*<p[^>]*>([^<]+)</);
        if (altMatch) aliases = altMatch[1].trim();

        // Anno
        let airdate = '';
        const yearMatch = html.match(/Pub[^<]*<\/[^>]+>\s*<p[^>]*>([^<]+)</);
        if (yearMatch) airdate = yearMatch[1].trim();

        return JSON.stringify([{ description, aliases, airdate }]);
    } catch (e) {
        console.log('extractDetails error:', e);
        return JSON.stringify([{ description: '', aliases: '', airdate: '' }]);
    }
}

async function extractChapters(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([]);
        const html = await response.text();

        // Pattern verificato: <div class="chapter"><a href="URL">Chapter N : Titolo</a></div>
        const chapterRegex = /<div class="chapter">\s*<a href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">([^<]+)<\/a>/g;
        const chapters = [];
        const seen = new Set();
        let match;

        while ((match = chapterRegex.exec(html)) !== null) {
            const href = match[1].trim();
            const rawTitle = match[2].trim();
            if (!seen.has(href)) {
                seen.add(href);
                // Estrai numero dal titolo es: "Chapter 100 : Il titolo" → 100
                const numMatch = rawTitle.match(/Chapter\s+([\d.]+)/i);
                const number = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
                chapters.push({ href, title: rawTitle, number });
            }
        }

        // MangaKatana mostra dal più recente al più vecchio → invertiamo per avere ordine crescente
        chapters.reverse();
        return JSON.stringify(chapters);
    } catch (e) {
        console.log('extractChapters error:', e);
        return JSON.stringify([]);
    }
}

async function extractText(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return 'Errore: impossibile caricare il capitolo.';
        const html = await response.text();

        // Le pagine sono nell'array JS: var thzq=['url1','url2',...];
        // Questo è il metodo principale verificato su mangakatana.com
        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            try {
                const pages = JSON.parse(thzqMatch[1]);
                if (pages && pages.length > 0) {
                    return pages
                        .map(src => `<img src='${src}' style='max-width:100%;height:auto;display:block;margin:10px auto;'/>`)
                        .join('');
                }
            } catch (_) {}
        }

        // Fallback: array ytaw (nome variabile alternativo usato dal sito)
        const ytawMatch = html.match(/var ytaw\s*=\s*(\[[\s\S]*?\]);/);
        if (ytawMatch) {
            try {
                const pages = JSON.parse(ytawMatch[1]);
                if (pages && pages.length > 0) {
                    return pages
                        .map(src => `<img src='${src}' style='max-width:100%;height:auto;display:block;margin:10px auto;'/>`)
                        .join('');
                }
            } catch (_) {}
        }

        // Fallback: img con data-src nella sezione #imgs
        const imgRegex = /<div[^>]+class="wrap_img"[^>]*>\s*<img[^>]+data-src="([^"]+)"/g;
        const imgs = [];
        let m;
        while ((m = imgRegex.exec(html)) !== null) {
            // Esclude placeholder e immagini del sito
            if (!m[1].includes('/static/') && !m[1].includes('/imgs/banner')) {
                imgs.push(m[1]);
            }
        }
        if (imgs.length > 0) {
            return imgs
                .map(src => `<img src='${src}' style='max-width:100%;height:auto;display:block;margin:10px auto;'/>`)
                .join('');
        }

        return 'Nessuna pagina trovata per questo capitolo.';
    } catch (e) {
        console.log('extractText error:', e);
        return 'Errore estrazione pagine capitolo.';
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        const response = await fetchv2(
            url,
            options.headers ?? {},
            options.method ?? 'GET',
            options.body ?? null
        );
        // fetchv2 risolve sempre (mai reject). Se status è undefined → errore → fallback.
        if (response && response.status !== undefined) {
            return response;
        }
        throw new Error('fetchv2 error response');
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (err) {
            return null;
        }
    }
}
