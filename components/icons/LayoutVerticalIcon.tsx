import React from 'react';

interface IconProps {
    className?: string;
}

export const LayoutVerticalIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="M3 12h18"/>
    </svg>
);