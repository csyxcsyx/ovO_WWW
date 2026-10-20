import { Check, ChevronDown, X } from 'lucide-react';
import { questionById } from '../data/questions';
import type { AnswerRecord } from '../game/types';
import { answerLabel } from '../game/types';

function UrlText({ url }: { url: string }) {
  const match = url.match(/^https:\/\/(?:[^/@]*@)?([^/?#]+)/);
  if (!match) return <code>{url}</code>;
  const start = match[0].length - match[1].length;
  return <code>{url.slice(0, start)}<mark>{match[1]}</mark>{url.slice(start + match[1].length)}</code>;
}
export function Review({ history }: { history: AnswerRecord[] }) {
  return <section className="review-section" aria-label="本局逐题解析">{history.map((record, index) => {
    const question = questionById.get(record.questionId);
    if (!question) return null;
    return <details className="review-item" key={`${record.questionId}-${index}`}><summary><span className="review-index">{String(index + 1).padStart(2,'0')}</span><strong>{question.siteName}</strong><span className="review-outcome">{record.correct ? <Check size={17} aria-hidden="true" /> : <X size={17} aria-hidden="true" />}{record.correct ? '正确' : record.choiceId ? '答错' : '未作答'}</span><ChevronDown size={17} className="details-chevron" aria-hidden="true" /></summary>
      <div className="review-body"><p className="review-prompt">{question.prompt}</p>{question.choices.map(choice => <div key={choice.id} className={`review-choice ${choice.id === question.correctId ? 'review-correct' : ''}`}><span className="review-choice-label">{choice.id === question.correctId ? <><Check size={15} aria-hidden="true" />{answerLabel(question.objective)}</> : choice.id === record.choiceId ? '你的选择' : question.objective === 'impostor' ? '使用官网域名' : '干扰项'}</span><UrlText url={choice.url} /><p>{choice.explanation}</p></div>)}<p className="review-insight">{question.insight}</p><p className="review-source">依据：{question.source.title}<br />核验于 {question.source.checkedAt}</p></div>
    </details>;
  })}</section>;
}
