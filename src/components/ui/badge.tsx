import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "danger" | "brand" | "outline";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  className = "",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center font-medium rounded-full border transition-colors select-none";

  const variantStyles = {
    neutral: "bg-surface-200/80 text-ink-700 border-surface-300",
    brand: "bg-brand-50 text-brand-800 border-brand-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    outline: "bg-transparent text-ink-600 border-ink-300",
  };

  const sizeStyles = {
    sm: "text-[10px] uppercase tracking-wider px-2 py-0.5",
    md: "text-xs px-2.5 py-0.5",
  };

  return (
    <span
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
