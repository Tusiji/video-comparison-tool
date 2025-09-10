import React from 'react';
import { Tooltip } from './Tooltip';

interface IconProps { className?: string }

export interface SegmentedOption<T> {
  value: T;
  label: string;
  Icon?: React.ComponentType<IconProps>;
  disabled?: boolean;
}

interface SegmentedControlProps<T> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  showLabels?: boolean;
}

export function SegmentedControl<T>({ value, onChange, options, className = '', showLabels = true }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={`segment ${className}`}
    >
      {options.map((opt, idx) => {
        const active = Object.is(opt.value, value);
        const Button = (
          <button
            key={idx}
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`px-2.5 py-2 rounded-full text-sm transition-colors select-none flex items-center gap-2
              ${active ? 'pill-active' : 'pill'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={opt.label}
          >
            {opt.Icon ? <opt.Icon className="w-5 h-5" /> : null}
            {showLabels ? <span className="hidden sm:inline">{opt.label}</span> : null}
          </button>
        );
        return (
          <Tooltip key={idx} text={opt.label}>
            {Button}
          </Tooltip>
        );
      })}
    </div>
  );
}
