const html = `		<div class="chapter">
			<a href="https://mangakatana.com/manga/shokugeki-no-sanji.20998/c6">Chapter 6</a>
		</div>`;
const chapterRegex = /<div class="chapter">\s*<a href="(https:\/\/mangakatana\.com\/manga\/[^"]+)">([^<]+)<\/a>/g;
let m = chapterRegex.exec(html);
if (m) {
    console.log("Matched!", m[1], m[2]);
} else {
    console.log("Failed!");
}
