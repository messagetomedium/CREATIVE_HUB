import type { ReactNode } from 'react';
export function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 9 9 3M3 3h6v6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
export function FactoryMark() {
  return (
    <svg width="25" height="25" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 26V12l8 4V9l8 5V5h7v21H4Z" fill="currentColor" />
      <path d="M9 21h3m4 0h3m4 0h1" stroke="#263e33" strokeWidth="2" />
    </svg>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
export function PageHeading({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="screen-heading">
      <a className="back-link" href="#/">
        ← На главную
      </a>
      <div className="eyebrow">{tag}</div>
      <h1>
        {title}
        <span>.</span>
      </h1>
      {children && <p>{children}</p>}
    </div>
  );
}
