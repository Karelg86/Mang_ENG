const fs = require('fs');

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    if (!headers["User-Agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }
    return await fetch(url, options);
}

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://mangakatana.com/"
};

async function searchResults(keyword, page) {
    console.log(`[MangaKatana][Search] "${keyword}"`);
    try {
        const res = await soraFetch(`https://mangakatana.com/manga?search=${encodeURIComponent(keyword)}&search_by=book_name`, { headers: HEADERS });
        const html = await res.text();
        const seen = new Set();
        const hrefImgRegex = /href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">\s*<img data-src="([^"]+)"/g;
        const titleRegex = /<h3 class="title">\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
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
        const filtered = allResults.filter(function(r) { return r.title.toLowerCase().indexOf(kw) !== -1; });
        return filtered.length > 0 ? filtered : allResults;
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function extractChapters(urlOrId) {
    console.log(`[MangaKatana][Chapters] ${urlOrId}`);
    try {
        const res = await soraFetch(urlOrId, { headers: HEADERS });
        const html = await res.text();
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
        return chapters;
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function extractImages(chapterId) {
    try {
        const res = await soraFetch(chapterId, { headers: HEADERS });
        const html = await res.text();

        const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
        if (thzqMatch) {
            return JSON.parse(thzqMatch[1]);
        }
        const ytawMatch = html.match(/var ytaw\s*=\s*(\[[\s\S]*?\]);/);
        if (ytawMatch) {
            return JSON.parse(ytawMatch[1]);
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function run() {
    console.log("Searching for one piece...");
    const results = await searchResults("one piece");
    console.log("Search Results:", results.length);
    if (results.length > 0) {
        console.log("First Result:", results[0]);
        console.log("Extracting chapters for:", results[0].id);
        const chapters = await extractChapters(results[0].id);
        console.log("Chapters:", chapters.length);
        if (chapters.length > 0) {
            console.log("First Chapter:", chapters[0]);
            console.log("Extracting images for:", chapters[0].id);
            const images = await extractImages(chapters[0].id);
            console.log("Images:", images.length);
            if (images.length > 0) {
                console.log("First Image:", images[0]);
            }
        }
    }
}
run();
