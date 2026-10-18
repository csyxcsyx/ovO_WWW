import sharp from 'sharp';
import { access, mkdir, writeFile } from 'node:fs/promises';

await mkdir('public', {recursive:true}); await mkdir('assets',{recursive:true});
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="53" fill="#252525"/><circle cx="89" cy="87" r="40" fill="none" stroke="#f7f7f7" stroke-width="10"/><path d="m119 118 32 32M72 87l13 13 23-27" fill="none" stroke="#f7f7f7" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
await writeFile('assets/icon.svg', mark); await writeFile('public/favicon.svg',mark);
await sharp(Buffer.from(mark)).resize(200,200).png().toFile('assets/icon.png');
// 封面中的题目和反馈取自真实界面结构；可传入实际界面截图替换右侧预览。
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="510" height="272" viewBox="0 0 510 272">
<rect width="510" height="272" fill="#f3f3f1"/><circle cx="409" cy="140" r="142" fill="none" stroke="#dededb"/><circle cx="409" cy="140" r="111" fill="none" stroke="#e1e1de" stroke-dasharray="3 6"/>
<rect x="24" y="26" width="30" height="30" rx="9" fill="#282828"/><circle cx="37" cy="39" r="6.5" stroke="#fff" stroke-width="2" fill="none"/><path d="m42 44 5 5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
<g font-family="Microsoft YaHei, sans-serif" fill="#292929"><text x="64" y="47" font-size="14" font-weight="700">官网鉴定局</text><text x="25" y="111" font-size="30" font-weight="700">眼熟的官网，</text><text x="25" y="153" font-size="30" font-weight="700">未必是真的。</text><text x="26" y="188" font-size="11" fill="#737373">三个入口，一个真相。</text><rect x="25" y="216" width="149" height="29" rx="14.5" fill="#292929"/><text x="42" y="235" font-size="10" fill="#fff">60 秒竞速 · 三次机会生存</text></g>
<g transform="translate(284 26) rotate(3 96 110)"><rect width="198" height="222" rx="15" fill="#fff" stroke="#d9d9d6"/><text x="16" y="28" font-family="sans-serif" font-size="9" fill="#777">第 01 题 · 入门</text><text x="16" y="63" font-family="sans-serif" font-size="25" font-weight="bold" fill="#282828">bilibili</text><text x="16" y="84" font-family="Microsoft YaHei, sans-serif" font-size="9" fill="#777">以下哪个是它的官网入口？</text>
<g font-family="Consolas,monospace" font-size="9"><rect x="12" y="101" width="174" height="31" rx="7" fill="#eeeeeb"/><text x="22" y="120" fill="#777">A  https://biliibli.com/</text><rect x="12" y="140" width="174" height="31" rx="7" fill="#303030"/><text x="22" y="159" fill="#fff">B  https://bilibili.com/</text><path d="m165 155 4 4 7-8" stroke="#fff" fill="none" stroke-width="1.5"/><rect x="12" y="179" width="174" height="31" rx="7" fill="#eeeeeb"/><text x="22" y="198" fill="#777">C  https://bilibili.cn.com/</text></g></g></svg>`;
const screenshotPath = process.argv[2] || 'assets/game-preview.png';
const hasScreenshot = await access(screenshotPath).then(() => true).catch(() => false);
const base = hasScreenshot ? cover.replace(/<g transform="translate\(284 26\)[\s\S]*$/, '<rect x="314" y="17" width="144" height="238" rx="17" fill="#fff" stroke="#d9d9d6"/></svg>') : cover;
await writeFile('assets/cover.svg',base);
let output = sharp(Buffer.from(base));
if (hasScreenshot) {
  const preview = await sharp(screenshotPath).resize(132,224,{fit:'contain',background:'#f7f7f7'}).png().toBuffer();
  output = output.composite([{input:preview,left:320,top:24}]);
}
await output.png().toFile('assets/cover.png');
console.log('原创图标 200×200 / 封面 510×272 已生成。');
