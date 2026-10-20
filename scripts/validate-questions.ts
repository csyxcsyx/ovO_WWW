import assert from 'node:assert/strict';
import { sites, questions } from '../src/data/questions';

assert(sites.length >= 160, '至少160个网站');
assert(sites.filter(site => site.domestic).length >= 80, '至少80个国内常用网站');
assert(questions.length >= 1280, '至少1280道题');
assert.equal(new Set(sites.map(site => site.id)).size, sites.length, '网站ID唯一');
assert.equal(new Set(questions.map(question => question.id)).size, questions.length, '题目ID唯一');
const addedSites = sites.filter(site => site.id.startsWith('site-new-'));
assert(addedSites.length >= 30, '本次至少新增30个已核验网站');
for (const category of new Set(sites.map(site => site.category))) {
  assert(addedSites.filter(site => site.category === category).length >= 3, `${category} 至少新增3个网站`);
}
const signatures = new Set<string>();
const structuralUrl = (value: string) => {
  try {
    const url = new URL(value);
    // 无关参数或锚点变化不能充当全新题目；伪装在参数里的网址仍保留。
    if (!/https?%3a|https?:/i.test(url.search)) url.search = '';
    url.hash = '';
    return url.href;
  } catch { return value; }
};
for (const site of sites) {
  assert.equal(site.source.status, 200, `${site.name} 来源需正常读取`);
  assert(site.source.title && site.verifiedAt && site.acceptedHosts.includes(new URL(site.url).hostname));
  assert(!/just a moment|visitor system|access denied|\ufffd/i.test(site.source.title), '不收录验证页面或乱码标题');
  const related = questions.filter(question => question.siteId === site.id && question.challenge !== 'syntax');
  assert(related.length >= 8, `${site.name} 至少8道核心题目`);
  for (const challenge of ['classic', 'impostor', 'spot-difference', 'mixed']) {
    assert(related.filter(question => question.challenge === challenge).length >= 2, `${site.name} 的${challenge}变体不足`);
  }
}
for (const question of questions) {
  const site = sites.find(site => site.id === question.siteId)!;
  assert.equal(question.choices.length, 3);
  assert.equal(new Set(question.choices.map(choice => choice.id)).size, 3);
  assert.equal(new Set(question.choices.map(choice => choice.url)).size, 3);
  assert.equal(question.choices.filter(choice => choice.id === question.correctId).length, 1);
  const official = question.choices.filter(choice => {
    try { return site.acceptedHosts.includes(new URL(choice.url).hostname); }
    catch { return false; }
  });
  let expected = official;
  if (question.objective === 'impostor') {
    assert.equal(official.length, 2, `${question.id} 反向题须两真一假`);
    expected = question.choices.filter(choice => !official.includes(choice));
    assert(question.prompt.includes('找冒牌'));
  } else if (question.objective === 'syntax') {
    expected = question.choices.filter(choice => /^https:\/\//.test(choice.url) && official.includes(choice));
    assert(question.prompt.includes('格式'));
  } else assert.equal(official.length, 1, `${question.id} 正向题须一真两假`);
  assert.equal(expected.length, 1, `${question.id} 必须恰有一个符合题意的选项`);
  assert.equal(expected[0].id, question.correctId);
  assert.equal(question.objective, question.challenge === 'impostor' ? 'impostor' : question.challenge === 'syntax' ? 'syntax' : 'official');
  assert(question.variantId && question.mechanisms.includes(question.primaryMechanism));
  if (question.challenge === 'mixed') assert(new Set(question.mechanisms).size >= 2, '混合题需不同的干扰机制');
  assert(question.insight && question.prompt && question.source.url);
  for (const choice of question.choices) {
    assert(choice.explanation.length > 8);
    if (question.objective !== 'syntax') assert.equal(new URL(choice.url).protocol, 'https:');
  }
  const signature = `${question.siteId}:${question.objective}:${question.choices.map(choice => structuralUrl(choice.url)).sort().join('|')}`;
  assert(!signatures.has(signature), `${question.id} 不得仅更换参数或题型标签凑题`);
  signatures.add(signature);
}
const tiers = Object.fromEntries(['easy', 'medium', 'hard'].map(tier => [tier, questions.filter(question => question.difficulty === tier).length]));
const types = Object.fromEntries(['classic', 'impostor', 'spot-difference', 'mixed', 'syntax'].map(type => [type, questions.filter(question => question.challenge === type).length]));
console.log(`题库通过：${sites.length} 网站 / ${questions.length} 题；难度 ${JSON.stringify(tiers)}；题型 ${JSON.stringify(types)}。答案、反向题、结构差异、来源和解析均已校验。`);
