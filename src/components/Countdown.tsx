import { useEffect, useRef } from 'react';

export function Countdown({ value, onCancel }: { value: number; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  return <dialog ref={dialog} className="countdown-overlay" aria-label="准备开始鉴定" onCancel={event => { event.preventDefault(); onCancel(); }}><div role="status" aria-live="assertive"><span>准备好，仔细看</span><strong key={value}>{value}</strong><button className="button-quiet" onClick={onCancel}>取消</button></div></dialog>;
}
