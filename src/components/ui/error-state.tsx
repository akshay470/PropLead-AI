import React from "react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Unable to load data",
  message = "An unexpected error occurred while fetching information. Please try again.",
  onRetry,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-lg border border-rose-200 bg-rose-50/50 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center mb-3 text-rose-600">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h4 className="text-sm font-semibold text-rose-950 tracking-tight">{title}</h4>
      <p className="text-xs text-rose-700 max-w-sm mt-1 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
