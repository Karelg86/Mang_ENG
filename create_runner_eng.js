const fs = require('fs');
let code = fs.readFileSync('D:/Sora_Sulfur/MangENG_Git/manga_extractor.js', 'utf8');

const mockSoraFetch = 
async function soraFetch(url, options) {
    // console.log('[MOCK FETCH] ' + url);
    const res = await fetch(url, options);
    return res;
}
;

code = code.replace(/async function soraFetch[\s\S]*/, mockSoraFetch);
code += 
(async () => {
    try {
        console.log('\\n--- TEST SEARCH MANGAKATANA ---');
        const results = await searchResults('one piece');
        console.log('Search Results:', results.length > 0 ? 'OK (' + results.length + ' found)' : 'FAIL');
        if (results.length === 0) return;
        
        console.log('\\n--- TEST DETAILS ---');
        const details = await extractDetails(results[0].id);
        console.log('Details:', details.description ? 'OK' : 'FAIL');

        console.log('\\n--- TEST CHAPTERS ---');
        const chaptersDict = await extractChapters(results[0].id);
        const lang = Object.keys(chaptersDict)[0];
        const chapters = chaptersDict[lang];
        console.log('Chapters:', chapters && chapters.length > 0 ? 'OK (' + chapters.length + ' found in ' + lang + ')' : 'FAIL');
        if (!chapters || chapters.length === 0) return;

        console.log('\\n--- TEST IMAGES ---');
        const chapId = chapters[chapters.length-1][1][0].id;
        console.log('Chapter ID to fetch:', chapId);
        const images = await extractImages(chapId);
        console.log('Images:', images && images.length > 0 ? 'OK (' + images.length + ' found)' : 'FAIL');
        if (images && images.length > 0) {
            console.log('First image:', images[0]);
        }
    } catch(e) {
        console.error('FATAL ERROR:', e);
    }
})();
;

fs.writeFileSync('D:/Sora_Sulfur/MangENG_Git/runner_eng.js', code);
