import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rectangular" | "circular";
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "rectangular",
  className = "",
  ...props
}) => {
  const baseStyles = "animate-pulse bg-surface-300/60";

  const variantStyles = {
    text: "h-3.5 rounded w-full",
    rectangular: "rounded-md",
    circular: "rounded-full",
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};
