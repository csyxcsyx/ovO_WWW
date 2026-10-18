import rawSites from './sites.json';
import type { Choice, Question, Site } from '../game/types';

export const sites: Site[] = rawSites;
const allKnownHosts = new Set(sites.flatMap(s => s.acceptedHosts));
function typos(host: string): [string, string] {
  const parts = host.split('.');
  const index = parts[0] === 'www' ? 1 : 0;
  const label = parts[index];
  const variants = [
    label.length > 3 ? label.slice(0, 2) + label.slice(3) : label + 's',
    label.length > 2 ? label[0] + label[2] + label[1] + label.slice(3) : label.split('').reverse().join(''),
    label.slice(0, -1) + (label.endsWith('n') ? 'm' : 'n'),
    label + 's', label + 'e',
  ];
  const result: string[] = [];
  for (const variant of variants) {
    const next = [...parts]; next[index] = variant;
    const full = next.join('.');
    if (variant !== label && !allKnownHosts.has(full) && !result.includes(full)) result.push(full);
  }
  if (result.length < 2) throw new Error(`无法制作拼写题：${host}`);
  return [result[0], result[1]];
}
function createQuestion(site: Site, kind: Question['kind'], position: number): Question {
  const host = new URL(site.url).hostname;
  const id = `${site.id}-${kind}`;
  const correctId = `${id}-real`;
  const suffix = position % 2 ? 'account-portal.com' : 'web-passport.net';
  let correctUrl = site.url;
  let distractors: [string, string];
  let reasons: [string, string];
  let prompt = '以下哪个是它的官网入口？';
  let insight = `认准官网主机名 ${host}。拼写接近不代表是同一个网站。`;
  let difficulty: Question['difficulty'] = 'easy';
  if (kind === 'spelling') {
    const [a, b] = typos(host);
    distractors = [`https://${a}/`, `https://${b}/`];
    reasons = [`主机名写成了 ${a}，与官网的 ${host} 不同。`, `看起来很像，但 ${b} 的拼写与 ${host} 不同。`];
  } else if (kind === 'hierarchy') {
    difficulty = 'medium';
    prompt = '哪条网址的主机名属于它的官网？';
    correctUrl = position % 3 === 0 ? `${site.url}?from=web` : site.url;
    distractors = [`https://${host}.cn.com/`, `https://${host}.${suffix}/`];
    reasons = [`在 ${host} 后面继续接 .cn.com，实际主机名已变成 ${host}.cn.com。`, `这里 ${host} 只是 ${suffix} 前的子域名，不能据此认定属于该官网。`];
    insight = '先看 / 前的完整主机名；熟悉的官网名出现在左边，并不能决定网址归属。';
  } else if (kind === 'authority') {
    difficulty = 'hard';
    prompt = '看清 @：哪条网址仍指向它的官网主机？';
    correctUrl = `${site.url}?from=${suffix}`;
    distractors = [`https://${host}@${suffix}/`, `https://${host}.account-web.net/`];
    reasons = [`@ 前的 ${host} 是用户信息，真正的主机名是 ${suffix}。`, `真正的主机名是 ${host}.account-web.net，官网名仅被放在了子域名位置。`];
    insight = `@ 前是用户信息；? 后是查询参数。正确项的主机名仍为 ${host}，参数不会改变它。`;
  } else if (kind === 'path') {
    difficulty = 'hard';
    prompt = '路径和参数也会伪装，哪条实际使用官网主机？';
    correctUrl = position % 2 ? `${site.url}?continue=https%3A%2F%2F${suffix}` : `${site.url}?utm_source=heybox&utm_medium=challenge`;
    distractors = [`https://${suffix}/${host}/`, `https://web-account.net/?redirect=https%3A%2F%2F${host}%2F`];
    reasons = [`${host} 在 / 后的路径里，实际主机名是 ${suffix}。`, `官网名藏在 redirect 参数中，当前主机名仍是 web-account.net，不能当成官网入口。`];
    insight = `决定当前网址归属的是主机名 ${host}；路径、来源参数和 redirect 参数都不会改变当前主机名。`;
  } else {
    difficulty = 'medium';
    prompt = '只看书写规范：哪个完整使用标准 https:// 前缀？';
    distractors = [`https:/${host}/`, `https//${host}/`];
    reasons = ['缺少一个 /。URL 解析器可能自动修正到官网，但不符合本题要求的规范书写。', 'https 后缺少冒号，不能作为本题要求的完整 HTTPS 绝对网址。'];
    insight = '这是一道格式题，不是在判定网站真假。浏览器能修正的地址，也可能不符合规范书写。';
  }
  const choices: Choice[] = [
    { id: correctId, url: correctUrl, explanation: kind === 'syntax' ? '完整的 https:// 前缀，使用了已核验的官网主机名。' : `实际主机名为 ${host}，与已核验的官网入口一致。` },
    ...distractors.map((url, i) => ({ id: `${id}-decoy-${i}`, url, explanation: reasons[i] })),
  ];
  return { id, siteId: site.id, siteName: site.name, category: site.category, difficulty, kind, prompt, choices, correctId, insight, source: site.source };
}
export const questions: Question[] = sites.flatMap((site, index) => {
  const kinds: Question['kind'][] = ['spelling', 'hierarchy', 'authority', 'path'];
  if (index % 10 === 0) kinds.push('syntax');
  return kinds.map(kind => createQuestion(site, kind, index));
});
export const questionById = new Map(questions.map(q => [q.id, q]));
