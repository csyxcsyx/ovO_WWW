import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { usableSource } from './source-utils.mjs';

const read = async path => JSON.parse(await readFile(path, 'utf8'));
const [candidates, checks, existing, evidence] = await Promise.all([
  read('docs/site-candidates.json'), read('output/source-checks.json'),
  read('src/data/sites.json'), read('docs/source-checks.json'),
]);
const sites = new Map(existing.map(site => [site.id, site]));
const sources = new Map(evidence.map(site => [site.id, site]));
for (const candidate of candidates.filter(site => site.reviewed === true)) {
  const check = checks.find(site => site.id === candidate.id);
  assert(check && check.url === candidate.url && usableSource(check.source), `缺少可用来源：${candidate.name}`);
  const host = new URL(candidate.url).hostname;
  const sourceHost = new URL(check.source.finalUrl).hostname;
  // 跨域证据必须在候选记录中明确登记，不自动信任任意跳转。
  assert(sourceHost === host || candidate.evidenceHosts?.includes(sourceHost), `需核对跳转归属：${candidate.name}`);
  assert(new URL(candidate.url).protocol === 'https:');
  assert(!existing.some(site => site.id !== candidate.id && site.name === candidate.name), `网站重复：${candidate.name}`);
  const site = { id: candidate.id, name: candidate.name, category: candidate.category,
    url: candidate.url, domestic: candidate.domestic, acceptedHosts: [host],
    source: check.source, verifiedAt: check.source.checkedAt };
  sites.set(site.id, site);
  sources.set(site.id, { ...site, reviewedAt: check.source.checkedAt });
}
assert(sites.size >= 160, '正式题库需至少160个已核验网站');
assert.equal(new Set([...sites.values()].map(site => site.name)).size, sites.size, '网站名称须唯一');
await writeFile('src/data/sites.json', JSON.stringify([...sites.values()], null, 2) + '\n');
await writeFile('docs/source-checks.json', JSON.stringify([...sources.values()], null, 2) + '\n');
console.log(`正式题库已整理：${sites.size} 个网站；已有核验资料与网站ID保持不变。`);
