import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export const Button = ({
  variant = 'primary',
  fullWidth = false,
  children,
  style,
  ...rest
}: ButtonProps) => {
  const baseStyle: React.CSSProperties = {
    height: '52px',
    minWidth: '44px',
    padding: '0 1.5rem',
    border: 'none',
    borderRadius: '8px',
    fontFamily: 'var(--u-font-body)',
    fontWeight: 500,
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'opacity var(--u-duration-fast)',
    width: fullWidth ? '100%' : undefined,
    ...(variant === 'primary'
      ? {
        background: 'var(--u-background-always-dark)',
        color: 'var(--u-content-on-color)',
      }
      : {
        background: 'var(--u-background-state-disabled)',
        color: 'var(--u-content-primary)',
      }),
    ...style,
  };

  return (
    <button
      type="button"
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...rest}
      style={{
        ...baseStyle,
        ...(rest.disabled ? { opacity: 0.35, cursor: 'not-allowed' } : {}),
      }}
    >
      {children}
    </button>
  );
};
