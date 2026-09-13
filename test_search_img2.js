const html1 = `<div class="wrap_img"><a href="https://mangakatana.com/manga/the-return-of-the-crazy-demon.25882"><img data-src="https://mangakatana.com/imgs/cover/09c/1e/24096.webp" alt="[Cover]"/></a></div>`;

const html2 = `<a href="https://mangakatana.com/manga/aishiteru-uso-dakedo.10797">
<picture><source srcset="https://mangakatana.com/imgs/cover/04e/36/39bbc.webp" type="image/webp"><img src="https://mangakatana.com/imgs/cover/04e/36/39bbc.jpg" alt="[Cover]"></picture></a>`;

const regex = /href="(https:\/\/mangakatana\.com\/manga\/[^"/]+)"[^>]*>(?:(?!<div)[\s\S])*?(?:data-src|srcset|src)="([^"]+)"/ig;

let m;
console.log("HTML1:");
while ((m = regex.exec(html1)) !== null) {
    console.log(m[1], m[2]);
}

regex.lastIndex = 0;
console.log("HTML2:");
while ((m = regex.exec(html2)) !== null) {
    console.log(m[1], m[2]);
}
