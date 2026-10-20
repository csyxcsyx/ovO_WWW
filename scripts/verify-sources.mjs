import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { checkSource } from './source-utils.mjs';

// 只访问人工列出的官网候选或其官方依据页；不访问干扰域名。
const candidates = JSON.parse(await readFile(process.argv[2] ?? 'docs/site-candidates.json', 'utf8'));
const results = [];
let index = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (index < candidates.length) {
    const site = candidates[index++];
    const source = await checkSource(site);
    results.push({ ...site, source });
    console.log(`${site.id}\t${site.name}\t${source.status}\t${source.title.slice(0, 100)}\t${source.finalUrl}`);
  }
}));
results.sort((a, b) => a.id.localeCompare(b.id));
await mkdir('output', { recursive: true });
await writeFile('output/source-checks.json', JSON.stringify(results, null, 2) + '\n');
console.log(`已核验 ${results.length} 个候选，结果保存在 output/source-checks.json。核对身份并标记 reviewed 后才能整理入库。`);
