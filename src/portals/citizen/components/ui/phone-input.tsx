'use client';

import { useRef, type CSSProperties } from 'react';

/**
 * Pure: full local PH mobile format ("09171234567") -> the 10-digit editable
 * part with the leading 0 stripped ("9171234567"). Also recognizes a pasted
 * international-format number ("+63 917 123 4567" or "639171234567") and
 * strips the country code instead of truncating it into garbage. Strips all
 * non-digits and caps at 10 digits so malformed/legacy values never crash
 * the input.
 */
export function toLocalDigits(value: string): string {
  let digitsOnly = (value ?? '').replace(/\D/g, '');
  if (digitsOnly.startsWith('63') && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(2);
  } else if (digitsOnly.startsWith('0')) {
    digitsOnly = digitsOnly.slice(1);
  }
  return digitsOnly.slice(0, 10);
}

/**
 * Pure: 10-digit local part (no leading 0) -> the full local format every
 * form/RPC in this app already expects ("9171234567" -> "09171234567").
 * Empty input stays empty (no dangling "0").
 */
export function fromLocalDigits(digits: string): string {
  return digits.length > 0 ? `0${digits}` : '';
}

/**
 * Pure: local digits ("9171234567") -> a spaced display grouping
 * ("917 123 4567"), matching the 9XX XXX XXXX placeholder. Formats however
 * far a partial/in-progress number reaches (e.g. "9171" -> "917 1").
 * Display-only — the value handed to onChange is always the plain digit
 * string, never this spaced form.
 */
export function formatLocalDigits(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ');
}

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Forwarded to the inner input. Callers pass 'tel-national' — the visible
   * field holds the local number only; the +63 prefix is a static adornment,
   * so plain 'tel' would invite a browser to autofill the country code twice. */
  autoComplete?: string;
  className?: string;
  inputStyle?: CSSProperties;
  placeholder?: string;
}

export function PhoneInput({
  id, value, onChange, required, autoComplete, className, inputStyle, placeholder = '9XX XXX XXXX',
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const localDigits = toLocalDigits(value);
  const displayValue = formatLocalDigits(localDigits);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cursor = e.target.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, '').length;

    const digits = toLocalDigits(raw);
    const formatted = formatLocalDigits(digits);

    let newCursor = formatted.length;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        seen++;
        if (seen === digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }
    }
    if (digitsBeforeCursor === 0) newCursor = 0;

    onChange(fromLocalDigits(digits));

    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(newCursor, newCursor);
    });
  }

  return (
    <div className="flex items-stretch">
      <span className="flex items-center px-3 border border-r-0 border-[#CCCCCC] rounded-l bg-[#F0F0F0] text-sm text-[#666666] select-none whitespace-nowrap">
        +63
      </span>
      <input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="numeric"
        required={required}
        autoComplete={autoComplete}
        className={`${className ?? ''} rounded-l-none`.trim()}
        style={inputStyle}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
}
