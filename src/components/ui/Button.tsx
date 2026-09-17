import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Button({ variant = 'primary', children, icon, className = '', ...props }: ButtonProps) {
  let baseClass = 'btn ';
  
  switch(variant) {
    case 'primary':
      baseClass += 'btn-primary';
      break;
    case 'secondary':
      baseClass += 'bg-[var(--bg-tertiary)] hover:bg-[var(--glass-border)] text-white';
      break;
    case 'danger':
      baseClass += 'bg-[var(--accent-danger)] hover:opacity-80 text-white';
      break;
    case 'ghost':
      baseClass += 'bg-transparent hover:bg-white/5 text-white';
      break;
  }

  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}
