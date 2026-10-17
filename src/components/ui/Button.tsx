import React from 'react';
import './button.scss';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export const Button = ({
  variant = 'primary',
  fullWidth = false,
  children,
  style,
  className,
  ...rest
}: ButtonProps) => {
  const cls = [
    'u-btn',
    `u-btn--${variant}`,
    fullWidth ? 'u-btn--full' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      style={style}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...rest}
    >
      {children}
    </button>
  );
};
