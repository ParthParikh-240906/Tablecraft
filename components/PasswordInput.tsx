"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Classes for the positioning wrapper (use this for max-width, not the input). */
  wrapperClassName?: string;
};

/**
 * Password field with a show/hide eye toggle. Forwards the ref and every input
 * prop (including id), so existing DOM lookups keep working.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { wrapperClassName = "w-full", className = "", style, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);

    return (
      <div className={`relative ${wrapperClassName}`}>
        <input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          style={{ ...style, paddingRight: "3rem" }}
          className={className}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[inherit] text-current opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-current"
        >
          {visible ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.2 3.1" />
              <path d="M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.6" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  },
);
