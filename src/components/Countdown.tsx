import { useLayoutEffect, useRef } from 'react';

export function Countdown({ value, onCancel }: { value: number; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prompt = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal(); prompt.current?.focus({ preventScroll: true });
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="countdown-overlay" aria-label="准备开始鉴定" onCancel={event => { event.preventDefault(); onCancel(); }}><div role="status" aria-live="assertive"><span ref={prompt} tabIndex={-1}>准备好，仔细看</span><strong key={value}>{value}</strong><button className="button-quiet" onClick={onCancel}>取消</button></div></dialog>;
}
