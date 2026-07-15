import React from 'react';

export type ActionIconKind =
  | 'actions'
  | 'back'
  | 'chevronDown'
  | 'clear'
  | 'download'
  | 'excel'
  | 'first'
  | 'last'
  | 'next'
  | 'previous'
  | 'refresh'
  | 'search';

interface ActionIconProps {
  kind: ActionIconKind;
  className?: string;
}

export function ActionIcon({ kind, className }: ActionIconProps) {
  const svgProps = {
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: false,
    className
  } as const;

  switch (kind) {
    case 'actions':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="5" r="1.8" fill="currentColor" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <circle cx="12" cy="19" r="1.8" fill="currentColor" />
        </svg>
      );

    case 'back':
      return (
        <svg {...svgProps}>
          <path d="M19 12H7M12 7L7 12L12 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'chevronDown':
      return (
        <svg {...svgProps}>
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'clear':
      return (
        <svg {...svgProps}>
          <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'download':
      return (
        <svg {...svgProps}>
          <path d="M12 4v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'excel':
      return (
        <svg {...svgProps}>
          <path d="M7 3.75h7.4L19 8.35V20.25H7z" fill="#ffffff" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
          <path d="M14.4 3.75v4.6H19" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
          <path d="M4.5 6.4h8.2v11.2H4.5z" fill="currentColor" />
          <path d="M6.55 9.35l4.1 5.3M10.65 9.35l-4.1 5.3" fill="none" stroke="#ffffff" strokeWidth="1.55" strokeLinecap="round" />
          <path d="M14.8 11.1h2.15M14.8 14.1h2.15M14.8 17.1h2.15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );

    case 'first':
      return (
        <svg {...svgProps}>
          <path d="M7 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'last':
      return (
        <svg {...svgProps}>
          <path d="M17 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'next':
      return (
        <svg {...svgProps}>
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'previous':
      return (
        <svg {...svgProps}>
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'refresh':
      return (
        <svg {...svgProps}>
          <path d="M19 7v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.4 12a6.4 6.4 0 10-1.88 4.53L19 14.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'search':
      return (
        <svg {...svgProps}>
          <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    default:
      return null;
  }
}
