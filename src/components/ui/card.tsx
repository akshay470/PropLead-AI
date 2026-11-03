import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, hoverable = false, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-surface-50 border border-surface-300 rounded-lg shadow-sm transition-all ${
          hoverable ? "hover:border-surface-400 hover:shadow-md" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`p-4 sm:p-5 border-b border-surface-200 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <h3
      className={`text-base font-serif font-semibold text-ink-900 tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <p className={`text-xs text-ink-500 mt-0.5 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`p-4 sm:p-5 border-t border-surface-200 bg-surface-100/40 rounded-b-lg flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
