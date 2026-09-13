const fs = require('fs');
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    if (!headers["User-Agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
    }
    return await fetch(url, options);
}

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Referer": "https://mangakatana.com/"
};

async function searchResults(keyword, page) {
    const res = await soraFetch(`https://mangakatana.com/manga?search=${encodeURIComponent(keyword)}&search_by=book_name`, { headers: HEADERS });
    const html = await res.text();
    const seen = new Set();
    const hrefImgRegex = /href="(https:\/\/mangakatana\.com\/manga\/[^"/]+)"[^>]*>(?:(?!<div)[\s\S])*?(?:data-src|srcset|src)="([^"]+)"/ig;
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
}

async function run() {
    const res = await searchResults("one piece");
    console.log("Search Results:", res.length);
    if(res.length > 0) {
        console.log(res[0]);
    }
}
run();
