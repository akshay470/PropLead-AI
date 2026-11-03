import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary:
        "bg-brand-600 text-surface-50 hover:bg-brand-700 shadow-sm border border-brand-700 active:bg-brand-800",
      secondary:
        "bg-surface-50 text-ink-800 border border-surface-300 hover:bg-surface-100 hover:border-surface-400 active:bg-surface-200",
      outline:
        "bg-transparent text-ink-700 border border-ink-300 hover:border-ink-500 hover:text-ink-900 active:bg-surface-200",
      ghost:
        "bg-transparent text-ink-600 hover:text-ink-900 hover:bg-surface-200/60 active:bg-surface-200",
      danger:
        "bg-rose-600 text-white hover:bg-rose-700 border border-rose-700 active:bg-rose-800",
    };

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1.5 rounded-md gap-1.5",
      md: "text-sm px-3.5 py-2 rounded-md gap-2",
      lg: "text-base px-5 py-2.5 rounded-lg gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
