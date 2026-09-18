import React from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GlassPanel({ children, className = '', ...props }: GlassPanelProps) {
  return (
    <div className={`glass-panel ${className}`} {...props}>
      {children}
    </div>
  );
}
