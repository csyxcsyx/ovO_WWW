import { Globe2, Shield, Timer } from 'lucide-react';
import { sites, questions } from '../data/questions';

export function Rules() {
  return <div className="rules-content">
    <p className="dialog-lead">从三个网址中，选出符合题意的那一个。</p>
    <section className="rule-section"><Timer size={23} aria-hidden="true" /><div><h3>限时竞速</h3><p>60 秒内尽可能多答对。答对得 100 分，连击每题额外加 10 分，最高额外加 50 分。答错扣 3 秒并中断连击。</p></div></section>
    <section className="rule-section"><Shield size={23} aria-hidden="true" /><div><h3>生存挑战</h3><p>每题 12 秒，三次机会。答错或超时扣一次机会，机会用尽结束，按答对题数排名。</p></div></section>
    <section className="rule-section"><Globe2 size={23} aria-hidden="true" /><div><h3>越答越有挑战</h3><p>前 5 题入门，接着 5 题进阶，之后进入高手题。后台仍会计时，赛后可以逐题查看解析。</p></div></section>
    <div className="rules-source"><strong>{sites.length} 个网站 · {questions.length} 道题目</strong><p>官网入口核验于 2026 年 10 月 18 日。品牌名称仅用于题目识别；本游戏不代表相关品牌。题目中的非官网选项不等同于已证实的恶意网站。</p><p>格式题只判断规范书写，浏览器自动补全与官网归属会分别解释。</p><p>个人纪录保存在当前设备。每局正成绩会自动同步分数、答题统计与规则版本至平台榜单，每人每种玩法保留一条最佳成绩，昵称和头像用于公开榜单展示，不读取 Steam 等其他资料。已授权的昵称和头像在进入后独立更新，无需破纪录。旧本机纪录需本人确认后补传。连接失败时保留本机纪录；已确认账号的待同步成绩会保存在本机，重新打开后恢复，可在榜单重试。截图分享会保存到相册，是否发送由你决定。</p></div>
  </div>;
}
