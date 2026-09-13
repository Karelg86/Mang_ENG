const fs = require('fs');
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://mangakatana.com/"
};
async function extractImages(chapterId) {
    const res = await fetch(chapterId, { headers: HEADERS });
    const html = await res.text();
    console.log("HTML length:", html.length);
    const thzqMatch = html.match(/var thzq\s*=\s*(\[[\s\S]*?\]);/);
    if (thzqMatch) {
        try {
            return JSON.parse(thzqMatch[1]);
        } catch (e) {
            console.log("JSON parse error:", e);
        }
    } else {
        console.log("thzqMatch failed");
        // Print the var if it exists
        const thzqRaw = html.match(/var thzq.*/);
        if (thzqRaw) console.log("Raw thzq line:", thzqRaw[0].substring(0, 100));
    }
    return [];
}
extractImages("https://mangakatana.com/manga/shokugeki-no-sanji.20998/c6").then(imgs => console.log("Images:", imgs.length));
