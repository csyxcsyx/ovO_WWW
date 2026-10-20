import rawSites from './sites.json';
import type { Challenge, Choice, Difficulty, Mechanism, Objective, Question, Site } from '../game/types';

export const sites: Site[] = rawSites;
const knownHosts = new Set(sites.flatMap(site => site.acceptedHosts));
const words = ['access', 'account', 'member', 'portal', 'service', 'download', 'connect', 'support', 'web', 'center', 'online', 'club'];
const suffixes = ['com', 'net', 'cn', 'org'];

function brandIndex(parts: string[]) {
  return Math.max(0, parts.length - (parts.at(-1) === 'cn' && ['com', 'net', 'org'].includes(parts.at(-2) ?? '') ? 3 : 2));
}
function lookalikes(host: string) {
  const parts = host.split('.');
  const index = brandIndex(parts);
  const label = parts[index];
  const variants: { host: string; mechanism: Mechanism }[] = [];
  const add = (next: string, mechanism: Mechanism) => {
    const copy = [...parts]; copy[index] = next;
    const candidate = copy.join('.');
    if (next && next !== label && !knownHosts.has(candidate) && !variants.some(item => item.host === candidate)) variants.push({ host: candidate, mechanism });
  };
  for (let i = 0; i < label.length; i++) add(label.slice(0, i) + label.slice(i + 1), 'omission');
  for (let i = 0; i < label.length; i++) add(label.slice(0, i) + label[i] + label.slice(i), 'insertion');
  for (let i = 0; i < label.length - 1; i++) add(label.slice(0, i) + label[i + 1] + label[i] + label.slice(i + 2), 'transposition');
  const digits: Record<string, string> = { o: '0', l: '1', i: '1', e: '3', a: '4', s: '5', b: '8', g: '9' };
  for (let i = 0; i < label.length; i++) add(label.slice(0, i) + (digits[label[i]] ?? (label[i] === 'n' ? 'm' : 'n')) + label.slice(i + 1), 'substitution');
  if (variants.length < 4) throw new Error(`缺少足够的拼写变体：${host}`);
  return variants;
}
function hash(value: string) { return Array.from(value).reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 17); }
function fakeHost(site: Site, offset: number) {
  const parts = new URL(site.url).hostname.split('.');
  const brand = parts[brandIndex(parts)];
  let index = hash(site.id) + offset;
  for (let attempt = 0; attempt < 100; attempt++, index++) {
    const word = words[index % words.length];
    const host = `${brand}-${word}.${suffixes[Math.floor(index / words.length) % suffixes.length]}`;
    if (!knownHosts.has(host)) return host;
  }
  throw new Error(`无法生成非匹配域名：${site.id}`);
}
function buildSiteQuestions(site: Site, position: number): Question[] {
  const host = new URL(site.url).hostname;
  const typo = lookalikes(host);
  const missing = typo.find(item => item.mechanism === 'omission') ?? typo[0];
  const extra = typo.find(item => item.mechanism === 'insertion')!;
  const swapped = typo.find(item => item.mechanism === 'transposition') ?? typo.find(item => item.mechanism === 'substitution')!;
  const replaced = typo.find(item => item.mechanism === 'substitution' && item.host !== swapped.host)!;
  const decoy = fakeHost(site, 0);
  const other = fakeHost(site, 7);
  const official = (variant: number) => {
    const url = new URL(site.url);
    if (variant % 6 === 1) url.search = '?lang=zh-CN';
    if (variant % 6 === 2) url.search = '?from=community';
    if (variant % 6 === 3) url.hash = 'home';
    if (variant % 6 === 4) url.username = 'guest';
    if (variant % 6 === 5) url.username = decoy;
    return url.href;
  };
  const withHost = (next: string, variant: number) => { const url = new URL(official(variant)); url.hostname = next; return url.href; };
  const trusted = (url: string) => ({ url, explanation: new URL(url).username
    ? `@ 前是用户信息，@ 后的 ${host} 才是实际域名，与本题已核验的官网入口一致。不能只因出现 @ 就判断为冒牌。`
    : `实际域名为 ${host}，与本题已核验的官网入口一致；路径、参数和 # 后的内容不改变域名。` });
  const fake = (url: string, explanation: string) => ({ url, explanation });
  const misspelled = (item: typeof missing, variant: number) => fake(withHost(item.host, variant), `这里写成了 ${item.host}，与已核验的 ${host} 不同。仔细比较字母的数量、位置和数字。`);
  const hierarchy = (suffix: string, variant: number) => fake(withHost(`${host}.${suffix}`, variant), `${host} 后还接着 .${suffix}，完整域名已改变，不能把左边的官网名当成当前官网。`);
  const userinfo = fake(`https://${host}@${decoy}/`, `@ 前的 ${host} 是用户信息；真正的域名是 ${decoy}，与已核验官网不同。`);
  const path = fake(`https://${decoy}/${host}/`, `${host} 藏在 / 后的路径中，当前域名是 ${decoy}，并非本题已核验的官网域名。`);
  const query = fake(`https://${other}/?next=https%3A%2F%2F${host}%2F`, `官网网址出现在 ? 后的参数中，当前域名仍为 ${other}，不能只凭参数中的品牌名判断。`);
  const result: Question[] = [];
  function add(challenge: Challenge, variantId: string, difficulty: Difficulty, mechanisms: Mechanism[], options: { url: string; explanation: string }[], target: number, insight: string) {
    const objective: Objective = challenge === 'impostor' ? 'impostor' : challenge === 'syntax' ? 'syntax' : 'official';
    const id = `${site.id}-${challenge}-${variantId}`;
    const prompts: Record<Challenge, string> = {
      classic: '找正版：哪条网址使用了它的官网域名？',
      impostor: '找冒牌：哪一条没有使用它的官网域名？',
      'spot-difference': '一字之差：看清字母，选出官网域名。',
      mixed: '混合迷惑：哪条网址仍使用它的官网域名？',
      syntax: '只看书写格式：哪个完整写对了 https:// 前缀？',
    };
    const choices: Choice[] = options.map((option, index) => ({ ...option, id: `${id}-${index}` }));
    if (objective === 'impostor') {
      choices.forEach((choice, index) => { choice.explanation = index === target
        ? `本题应选这一项：${choice.explanation}`
        : `这条使用官网域名，不是本题要找的冒牌项。${choice.explanation}`; });
    }
    result.push({ id, siteId: site.id, siteName: site.name, category: site.category,
      challenge, objective, variantId, difficulty, mechanisms, primaryMechanism: mechanisms[0],
      prompt: prompts[challenge], choices, correctId: choices[target].id, insight, source: site.source });
  }
  add('classic', 'brand-word', 'easy', ['brand'], [trusted(official(position % 4)),
    fake(withHost(decoy, position % 4), `域名中拼上 ${words[hash(site.id) % words.length]} 等词并不能证明属于官网，实际域名与 ${host} 不同。`),
    fake(withHost(other, position % 4), `看见熟悉的品牌词不等于官网，请认准本题已核验的 ${host}。`)], 0, '熟悉的品牌名旁边加上“下载”“服务”等词，也不代表是官网。');
  add('classic', 'host-boundary', 'medium', ['hierarchy'], [trusted(official((position + 1) % 4)), hierarchy(decoy, (position + 1) % 4), hierarchy(other, (position + 1) % 4)], 0, '域名要看完整：官网名后面再接一段域名，就已经换了入口。');
  add('impostor', 'brand-claim', 'easy', ['brand'], [trusted(official(1)), trusted(official(2)),
    fake(withHost(other, 3), `这个域名虽然带着品牌词，但与本题核验的 ${host} 不同。`)], 2, '不要被“下载”“支持”等熟悉词带走：这次要选没有使用官网域名的那条。');
  add('impostor', 'changed-letter', 'medium', ['substitution'], [trusted(official(1)), misspelled(replaced, 2), trusted(official(3))], 1, `这次反过来找冒牌：两条都使用 ${host}，只有一条改了域名。参数不同不代表换了网站。`);
  add('impostor', 'before-at', 'hard', ['userinfo'], [trusted(official(4)), trusted(official(5)), userinfo], 2, '三条都有 @，只看有没有这个符号无法作答。看清 @ 后的域名，这次选没有使用官网域名的那条。');
  add('spot-difference', 'missing-extra', 'easy', [missing.mechanism, 'insertion'], [misspelled(missing, 0), trusted(official(0)), misspelled(extra, 0)], 1, `官网域名是 ${host}。多一个或少一个字母，都会变成不同的域名。`);
  add('spot-difference', 'swap-replace', 'medium', [swapped.mechanism, 'substitution'], [misspelled(swapped, 1), misspelled(replaced, 1), trusted(official(1))], 2, `逐个比较 ${host} 的字母顺序，也要留意相似的数字。`);
  add('spot-difference', 'repeat-replace', 'hard', ['substitution', 'insertion'], [misspelled(replaced, 3), trusted(official(3)), misspelled(extra, 3)], 1, `越眼熟越要慢看一眼：认准 ${host}，留意多出的字母与替换字符。`);
  add('mixed', 'letters-boundary', 'medium', ['omission', 'hierarchy'], [hierarchy(other, 2), trusted(official(2)), misspelled(missing, 2)], 1, '两个干扰项用了不同方式：一条改了字母，另一条把官网名放进更长的域名。');
  add('mixed', 'path-account', 'hard', ['path', 'userinfo'], [path, userinfo, trusted(official(position + 3))], 2, `路径里的官网名、@ 前的官网名都不能决定当前网址的归属；请认准 ${host}。`);
  add('mixed', 'query-letters', 'hard', ['query', 'transposition'], [trusted(official(position + 2)), query, misspelled(swapped, position + 2)], 0, '一条把官网藏在参数里，另一条改动字母。看清当前域名，再作选择。');
  if (position % 8 === 0) add('syntax', 'https-prefix', 'medium', ['syntax'], [
    { url: site.url, explanation: '完整使用 https:// 前缀，冒号与两个斜杠都齐全，符合本题的书写要求。' },
    { url: `https:/${host}/`, explanation: '少了一个斜杠。浏览器可能自动修正，但不符合本题要求的规范书写。' },
    { url: `https//${host}/`, explanation: 'https 后缺少冒号，不是本题要求的完整 HTTPS 绝对网址。' },
  ], 0, '这道只看格式，不判断网站真假：浏览器可能自动修正的地址，也不一定符合规范书写。');
  return result;
}

export const questions: Question[] = sites.flatMap(buildSiteQuestions);
export const questionById = new Map(questions.map(question => [question.id, question]));
