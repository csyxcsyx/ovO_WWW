import assert from 'node:assert/strict';
import { sites, questions } from '../src/data/questions';

assert(sites.length >= 100, '至少100个网站');
assert(sites.filter(s => s.domestic).length >= 80, '至少80个国内常用网站');
assert(questions.length >= 400, '至少400题');
assert.equal(new Set(sites.map(s => s.id)).size, sites.length, '网站ID唯一');
assert.equal(new Set(questions.map(q => q.id)).size, questions.length, '题目ID唯一');
for (const site of sites) {
  assert.equal(site.source.status, 200, `${site.name} 来源需正常读取`);
  assert(site.source.title && site.verifiedAt && site.acceptedHosts.includes(new URL(site.url).hostname));
  assert(!/just a moment|visitor system|access denied/i.test(site.source.title), '不收录验证页面');
}
for (const question of questions) {
  const site = sites.find(s => s.id === question.siteId)!;
  assert.equal(question.choices.length, 3);
  assert.equal(new Set(question.choices.map(c => c.id)).size, 3);
  assert.equal(new Set(question.choices.map(c => c.url)).size, 3);
  assert.equal(question.choices.filter(c => c.id === question.correctId).length, 1);
  const accepted = question.choices.filter(choice => {
    try {
      const url = new URL(choice.url);
      return site.acceptedHosts.includes(url.hostname) && (question.kind !== 'syntax' || /^https:\/\//.test(choice.url));
    } catch { return false; }
  });
  assert.equal(accepted.length, 1, `${question.id} 必须恰有一个符合题意的选项`);
  assert.equal(accepted[0].id, question.correctId);
  assert(question.insight && question.prompt && question.source.url);
  for (const choice of question.choices) assert(choice.explanation.length > 8);
  if (question.kind === 'syntax') assert(question.prompt.includes('书写规范'));
}
const tiers = Object.fromEntries(['easy','medium','hard'].map(tier => [tier, questions.filter(q => q.difficulty === tier).length]));
console.log(`题库通过：${sites.length} 网站 / ${sites.filter(s => s.domestic).length} 国内常用 / ${questions.length} 题；${JSON.stringify(tiers)}。每题唯一答案、网址结构、来源和解析均已校验。`);
