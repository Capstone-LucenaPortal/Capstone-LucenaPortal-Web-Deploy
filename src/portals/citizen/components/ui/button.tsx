'use client';

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<string, string> = {
  primary: 'inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all duration-200 hover:bg-[#002566] hover:shadow-[0_2px_8px_rgba(0,61,165,0.3)] disabled:bg-[#CCCCCC] disabled:cursor-not-allowed',
  secondary: 'inline-flex items-center justify-center bg-lucena-yellow text-black border-none rounded text-[15px] font-semibold cursor-pointer transition-all duration-200 hover:bg-[#E6A80E] disabled:opacity-60 disabled:cursor-not-allowed',
  ghost: 'bg-transparent border-none text-text-dark cursor-pointer text-[15px] font-medium rounded transition-all duration-200 hover:bg-medium-gray hover:text-lucena-blue disabled:opacity-60 disabled:cursor-not-allowed',
};

const variantDefaultStyle: Record<string, CSSProperties> = {
  primary: { paddingLeft: 28, paddingRight: 28, paddingTop: 12, paddingBottom: 12, gap: 8 },
  secondary: { paddingLeft: 28, paddingRight: 28, paddingTop: 12, paddingBottom: 12, gap: 8 },
  ghost: { paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 },
};

/**
 * The outlined-blue "Return to Home" button, as inline style rather than Tailwind
 * classes. That is deliberate, not the styling hybrid being ignored.
 *
 * The ghost variant already sets `text-text-dark` and `border-none`. There is no
 * tailwind-merge here, so a competing `text-lucena-blue` class is resolved by
 * stylesheet order rather than the order written on the element — and
 * `.text-text-dark` is emitted AFTER `.text-lucena-blue`, so the variant would
 * win and this label would render grey. `border-none` sets `border-style: none`,
 * which a `border-2` class leaves in place, giving a 2px invisible border.
 * Inline style outranks both, and is the only reliable override available.
 *
 * The colour comes from the design token rather than a repeated literal, and
 * matches the sibling button `ReceiptLink` renders on the same screen. Paddings
 * are longhand so they merge with the variant's own longhands instead of mixing
 * a shorthand in, which React warns about if the style ever updates.
 */
export const OUTLINED_GHOST_STYLE: CSSProperties = {
  paddingTop: 14,
  paddingBottom: 14,
  paddingLeft: 24,
  paddingRight: 24,
  fontWeight: 700,
  border: '2px solid var(--color-lucena-blue)',
  color: 'var(--color-lucena-blue)',
};

/** The matching sizing for a primary action beside it. */
export const WIDE_PRIMARY_STYLE: CSSProperties = {
  paddingTop: 14,
  paddingBottom: 14,
  paddingLeft: 24,
  paddingRight: 24,
  fontWeight: 700,
};

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={`${variantClasses[variant]} ${className}`}
      style={{ ...variantDefaultStyle[variant], ...style }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
