export function BrandMark({ className = '' }: { className?: string }) {
  return <svg className={className} width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="36" height="36" rx="12" fill="currentColor" />
    <circle cx="18" cy="18" r="8" stroke="var(--paper, #f7f7f5)" strokeWidth="2.4" />
    <path d="m24 24 6 6M14.8 18l2.3 2.3 4-4.6" stroke="var(--paper, #f7f7f5)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
