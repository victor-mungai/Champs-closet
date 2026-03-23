import React from 'react';

const Button = ({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'outline' }) => {
  const baseStyle = 'inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-all duration-300 ease-out';
  const variants = {
    primary: 'bg-gradient-to-br from-primary to-primary-container text-on-primary hover:shadow-lg hover:shadow-primary/20',
    secondary: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
    ghost: 'bg-transparent text-on-surface hover:bg-surface-container-low',
    outline: 'border border-outline-variant text-on-surface hover:bg-surface-container-lowest',
  };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
