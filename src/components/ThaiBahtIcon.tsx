import React from 'react';

interface ThaiBahtIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

export const ThaiBahtIcon: React.FC<ThaiBahtIconProps> = ({
  className = 'w-7 h-7 text-emerald-500',
  size = 24,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Center vertical bar */}
      <line x1="12" y1="2" x2="12" y2="22" />
      {/* Top bowl */}
      <path d="M7 5h5a3.5 3.5 0 0 1 0 7H7" fill="currentColor" fillOpacity="0.15" />
      {/* Bottom bowl */}
      <path d="M7 12h5.5a3.5 3.5 0 0 1 0 7H7" fill="currentColor" fillOpacity="0.15" />
      {/* Left straight spine */}
      <line x1="7" y1="5" x2="7" y2="19" />
    </svg>
  );
};
