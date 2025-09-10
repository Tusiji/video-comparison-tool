import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  return (
    <div className="relative inline-flex group">
      {children}
      <div 
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded-md shadow-lg tooltip-surface
                   whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 
                   transition-all duration-200 ease-in-out pointer-events-none"
        role="tooltip"
      >
        {text}
        {/* Arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4" style={{ borderTopColor: 'var(--popover-bg)' }}></div>
      </div>
    </div>
  );
};
