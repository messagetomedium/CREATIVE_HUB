import type { ReactNode } from 'react';

export type ConstructorIconName =
  | 'body'
  | 'head'
  | 'clothes'
  | 'details'
  | 'mouth'
  | 'eyes'
  | 'features'
  | 'hair'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'hat'
  | 'jewelry'
  | 'special'
  | 'left'
  | 'right'
  | 'idle'
  | 'walk';

/** Small original UI placeholders, deliberately independent of future sprite artwork. */
export function ConstructorIcon({ name }: { name: ConstructorIconName }) {
  const paths: Record<ConstructorIconName, ReactNode> = {
    body: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <path d="M8 10h8l2 7h-4v4h-4v-4H6l2-7Z" />
      </>
    ),
    head: (
      <>
        <path d="M18 10c0 5-2 9-6 9s-6-4-6-9a6 6 0 0 1 12 0ZM9 21h6" />
        <path d="M9 10h.01M15 10h.01M10 14h4" />
      </>
    ),
    clothes: <path d="m8 4-5 4 3 5 2-1v8h8v-8l2 1 3-5-5-4a4 4 0 0 1-8 0Z" />,
    details: (
      <>
        <path d="m12 3 2.5 6 6.5 3-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-3L12 3Z" />
        <path d="M20 3v4M18 5h4" />
      </>
    ),
    mouth: (
      <>
        <path d="M3 12c3-1 5-4 7-3l2 1 2-1c2-1 4 2 7 3-3 5-6 6-9 6s-6-1-9-6Z" />
        <path d="M3 12h18" />
      </>
    ),
    eyes: (
      <>
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    features: (
      <>
        <path d="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3 2-6Z" />
        <path d="M20 5h.01M4 19h.01" />
      </>
    ),
    hair: (
      <>
        <path d="M5 19V10a7 7 0 0 1 14 0v9l-4-2M5 11c5 0 7-3 8-6 0 4 3 6 6 6M8 12v3a4 4 0 0 0 8 0v-3" />
      </>
    ),
    top: <path d="m8 4-5 4 3 5 2-1v8h8v-8l2 1 3-5-5-4a4 4 0 0 1-8 0Z" />,
    bottom: <path d="M6 4h12l1 16h-6l-1-9-1 9H5L6 4ZM6 8h12" />,
    shoes: <path d="M4 8h6l2 5 7 2 2 3v2H3V9l1-1ZM3 17h16M12 13l-1 3M15 14l-1 2" />,
    hat: (
      <>
        <path d="M6 14V9a6 6 0 0 1 12 0v5M3 14h18v4H3zM6 11h12" />
      </>
    ),
    jewelry: (
      <>
        <path d="M5 5c0 7 2 11 7 11s7-4 7-11M12 16l-3 3 3 3 3-3-3-3Z" />
      </>
    ),
    special: (
      <>
        <path d="M6 13V9a6 6 0 0 1 12 0v4M6 12H3v7h4v-7H6ZM18 12h3v7h-4v-7h1Z" />
      </>
    ),
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
    idle: (
      <>
        <circle cx="12" cy="4" r="2" />
        <path d="M9 21v-7M15 21v-7M7 14V9l2-1h6l2 1v5M9 8v7h6V8" />
      </>
    ),
    walk: (
      <>
        <circle cx="14" cy="4" r="2" />
        <path d="m8 21 4-7 4 3v4M12 14l1-7-5 4-3-1M13 7l3 5 4 1" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
