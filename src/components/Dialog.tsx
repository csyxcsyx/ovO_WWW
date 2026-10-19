import { useLayoutEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, children, onClose, compact = false, contentRef }: { title: string; children: ReactNode; onClose: () => void; compact?: boolean; contentRef?: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const close = useRef(onClose); close.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className={`dialog ${compact ? 'dialog-compact' : ''}`} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); close.current(); }} onClick={event => { if (event.target === event.currentTarget) close.current(); }}>
    <div className="dialog-inner"><div className="dialog-header"><h2 id={id} ref={heading} tabIndex={-1}>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21} aria-hidden="true" /></button></div><div className="dialog-content" ref={contentRef}>{children}</div></div>
  </dialog>;
}
