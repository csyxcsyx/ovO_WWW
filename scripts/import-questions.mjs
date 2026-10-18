import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve(process.argv[2] || 'docs/原始题库.md');
await mkdir('docs', { recursive: true });
await mkdir('src/data', { recursive: true });
if (source !== resolve('docs/原始题库.md')) await copyFile(source, 'docs/原始题库.md');
const markdown = await readFile(source, 'utf8');
let category = '';
const sites = new Map();
let count = 0;
for (const line of markdown.split(/\r?\n/)) {
  if (line.startsWith('## ')) category = line.slice(3).trim();
  if (!/^\|\s*\d+\s*\|/.test(line)) continue;
  const cells = line.split('|').map(s => s.trim());
  const name = cells[2].match(/「([^」]+)」/)?.[1];
  const answer = cells[6].replace(/[^ABC]/g, '');
  const url = cells[3 + answer.charCodeAt(0) - 65]?.replace(/`/g, '');
  if (!name || !url || !/^https:\/\//.test(url)) throw new Error(`无法解析：${line}`);
  count++;
  if (!sites.has(name)) sites.set(name, { id: `site-${String(sites.size + 1).padStart(3, '0')}`, name, category, url });
  else if (sites.get(name).url !== url) throw new Error(`同网站答案不一致：${name}`);
}
await writeFile('docs/imported-sites.json', JSON.stringify([...sites.values()], null, 2) + '\n');
console.log(`已保留原始题库：${count} 题、${sites.size} 个网站。候选资料写入 docs/imported-sites.json；正式题库以 src/data/sites.json 为准。`);
