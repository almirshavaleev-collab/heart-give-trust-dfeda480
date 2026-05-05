import type { SVGProps } from "react";

/**
 * Brand-colored payment logos for the donation widget.
 * Approximations of official marks — kept simple, no background.
 */

export const SbpLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="sbp-g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#1F8B4C" />
        <stop offset="50%" stopColor="#108CC9" />
        <stop offset="100%" stopColor="#D81B60" />
      </linearGradient>
    </defs>
    <g transform="translate(4 4)">
      <polygon points="0,16 8,2 16,16 8,30" fill="url(#sbp-g)" />
      <polygon points="14,16 22,2 30,16 22,30" fill="url(#sbp-g)" opacity="0.85" />
      <polygon points="28,16 36,2 44,16 36,30" fill="url(#sbp-g)" opacity="0.7" />
    </g>
    <text x="56" y="36" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="700" fill="#0B1F3A" textAnchor="end">СБП</text>
  </svg>
);

export const CardsLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 96 32" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Visa */}
    <text x="0" y="22" fontFamily="Arial Black, Arial, sans-serif" fontSize="16" fontWeight="900" fill="#1A1F71" fontStyle="italic">VISA</text>
    {/* Mastercard */}
    <g transform="translate(40 6)">
      <circle cx="9" cy="10" r="9" fill="#EB001B" />
      <circle cx="18" cy="10" r="9" fill="#F79E1B" />
      <path d="M13.5 3.4a9 9 0 0 0 0 13.2 9 9 0 0 0 0-13.2z" fill="#FF5F00" />
    </g>
    {/* Мир */}
    <g transform="translate(70 8)">
      <rect width="24" height="14" rx="2" fill="#0F754E" />
      <text x="12" y="11" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="700" fill="#FFFFFF" textAnchor="middle">МИР</text>
    </g>
  </svg>
);

export const SberPayLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 80 32" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(2 4)">
      {/* Sber green swirl approximation */}
      <path
        d="M22 12 A10 10 0 1 0 12 22"
        fill="none"
        stroke="#21A038"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M22 4 L18 8 L13 8 L13 4 Z" fill="#21A038" />
    </g>
    <text x="32" y="22" fontFamily="Inter, Arial, sans-serif" fontSize="14" fontWeight="700" fill="#0B1F3A">
      SberPay
    </text>
  </svg>
);

export const TPayLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 72 32" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="2" y="4" width="24" height="24" rx="5" fill="#FFDD2D" />
    <text x="14" y="23" fontFamily="Inter, Arial, sans-serif" fontSize="16" fontWeight="900" fill="#0B1F3A" textAnchor="middle">T</text>
    <text x="32" y="22" fontFamily="Inter, Arial, sans-serif" fontSize="14" fontWeight="700" fill="#0B1F3A">
      Pay
    </text>
  </svg>
);