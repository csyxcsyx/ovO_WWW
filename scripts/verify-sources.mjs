import { readFile, writeFile } from 'node:fs/promises';

// 只读取明确列出的官网页面，不访问题目中的干扰域名。
const candidates = JSON.parse(await readFile('output/question-import/sites.json', 'utf8'));
const names = new Set(`微信|QQ|QQ邮箱|腾讯网|微博|小红书|知乎|哔哩哔哩|豆瓣|百度贴吧|抖音|快手|今日头条|网易门户|新浪网|搜狐网|凤凰网|虎扑|百度|百度网盘|百度地图|百度翻译|百度百科|百度文库|百度知道|腾讯公司|网易公司|小黑盒|Steam 商店|Steam 社区|WeGame|TapTap|米哈游|原神国服|崩坏：星穹铁道国服|绝区零国服|王者荣耀|英雄联盟国服|和平精英|三角洲行动|腾讯游戏|网易游戏|游民星空|游侠网|3DM游戏网|机核|17173游戏网|4399小游戏|7k7k小游戏|Epic Games|GOG|育碧 Ubisoft|EA|Rockstar Games|Minecraft|淘宝|天猫|京东|拼多多|闲鱼|支付宝|微信支付|1688|唯品会|苏宁易购|美团|大众点评|饿了么|什么值得买|小米有品|顺丰速运|菜鸟速递|京东云|爱奇艺|优酷|腾讯视频|芒果TV|网易云音乐|QQ音乐|酷狗音乐|酷我音乐|喜马拉雅|起点中文网|晋江文学城|微信读书|番茄小说|掌阅|央视网|人民网|新华网|澎湃新闻|界面新闻|36氪|IT之家|少数派|虎嗅|爱范儿|中关村在线|太平洋科技|快科技|华为|小米|荣耀|OPPO|vivo|一加|联想中国|华硕|大疆|WPS|腾讯文档|金山文档|钉钉|飞书|语雀|腾讯会议|石墨文档|阿里云|腾讯云|华为云|DeepSeek|Kimi|豆包|智谱清言|腾讯元宝|讯飞星火|中国铁路12306|携程|去哪儿旅行|飞猪旅行|同程旅行|高德地图|马蜂窝|中国政府网|中国教育考试网|中国高等教育学生信息网（学信网）|研究生招生信息网（研招网）|国家中小学智慧教育平台|中国国家图书馆|中国天气网|北京大学|清华大学|复旦大学|中国科学院|BOSS直聘|智联招聘|前程无忧|猎聘|牛客|CSDN|稀土掘金|Gitee|博客园|开源中国|GitHub|MDN Web Docs|Vue.js|React|Python|npm`.split('|'));
const overseas = new Set(['Steam 商店', 'Steam 社区', 'Epic Games', 'GOG', '育碧 Ubisoft', 'EA', 'Rockstar Games', 'Minecraft', 'GitHub', 'MDN Web Docs', 'Vue.js', 'React', 'Python', 'npm']);
const rows = candidates.filter(s => names.has(s.name));
const results = [];
let index = 0;
await Promise.all(Array.from({ length: 14 }, async () => {
  while (index < rows.length) {
    const site = rows[index++];
    const sourceUrl = site.url;
    let evidence;
    try {
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(14000), headers: { 'user-agent': 'Mozilla/5.0 OfficialInspector-SourceCheck/1.0' } });
      const reader = response.body?.getReader();
      let html = '';
      const decoder = new TextDecoder();
      if (reader) {
        while (html.length < 500000) {
          const part = await reader.read();
          if (part.done) break;
          html += decoder.decode(part.value, { stream: true });
        }
        await reader.cancel().catch(() => {});
      }
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '';
      evidence = { status: response.status, title, finalUrl: response.url, checkedAt: new Date().toISOString().slice(0, 10) };
    } catch (error) {
      evidence = { status: 0, title: '', finalUrl: sourceUrl, checkedAt: new Date().toISOString().slice(0, 10), error: String(error.message).slice(0, 120) };
    }
    results.push({ ...site, domestic: !overseas.has(site.name), source: { url: sourceUrl, ...evidence } });
    console.log(`${site.name}\t${evidence.status}\t${evidence.title.slice(0, 90)}\t${evidence.finalUrl}`);
  }
}));
results.sort((a,b) => a.id.localeCompare(b.id));
await writeFile('docs/source-checks.json', JSON.stringify(results, null, 2) + '\n');
console.log(`已检查 ${results.length} 个官网入口。须审查页面身份后才纳入正式题库。`);
