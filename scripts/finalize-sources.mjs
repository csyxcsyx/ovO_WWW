import { readFile, writeFile } from 'node:fs/promises';

const sources = JSON.parse(await readFile('docs/source-checks.json', 'utf8'));
// 裸域的 TLS/跳转配置可能不同于 www；只使用逐一访问确认的入口。
const corrections = {
  '中国铁路12306': 'https://www.12306.cn/',
  '中国政府网': 'https://www.gov.cn/',
  '中国教育考试网': 'https://www.neea.edu.cn/',
  '中国高等教育学生信息网（学信网）': 'https://www.chsi.com.cn/',
  '清华大学': 'https://www.tsinghua.edu.cn/',
  '北京大学': 'https://www.pku.edu.cn/',
  '顺丰速运': 'https://www.sf-express.com/',
  '腾讯公司': 'https://www.tencent.com/',
  '联想中国': 'https://www.lenovo.com.cn/',
};
await Promise.all(Object.entries(corrections).map(async ([name, url]) => {
  const site = sources.find(s => s.name === name);
  if (!site) return;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(16000) });
    const html = await r.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
    site.url = url;
    site.source = { url, finalUrl: r.url, status: r.status, title, checkedAt: new Date().toISOString().slice(0, 10) };
    console.log(name, r.status, title);
  } catch { console.log(name, '未确认，暂不收录'); }
}));
const eligible = sources.filter(s => s.source.status === 200 && s.source.title && !/visitor system|just a moment|access denied|\ufffd/i.test(s.source.title));
const sites = eligible.map(site => {
  // 官方页面的同源跳转作为当前入口，保留完整 source 供追溯。
  const final = new URL(site.source.finalUrl);
  const original = new URL(site.url);
  const host = final.protocol === 'https:' ? final.hostname : original.hostname;
  const sourceTitle = site.source.title.replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
  return { ...site, url: `https://${host}/`, acceptedHosts: [...new Set([host, original.hostname])], source: { ...site.source, title: sourceTitle }, verifiedAt: site.source.checkedAt };
});
if (sites.length < 100 || sites.filter(s => s.domestic).length < 80) throw new Error('官网核验覆盖不足');
await writeFile('src/data/sites.json', JSON.stringify(sites, null, 2) + '\n');
await writeFile('docs/source-checks.json', JSON.stringify(sources, null, 2) + '\n');
console.log(`正式题库：${sites.length} 个网站，其中国内常用 ${sites.filter(s => s.domestic).length} 个。已排除无法核验及访问校验页。`);
