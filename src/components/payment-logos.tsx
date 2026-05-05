import type { SVGProps } from "react";

/**
 * Official-style payment logos used in the donation widget.
 * Vector reproductions of public brand marks (СБП / Мир / SberPay / T‑Pay)
 * in their original brand colours, no background.
 */

export const SbpLogo = (props: SVGProps<SVGSVGElement>) => (
  // НСПК / Система быстрых платежей — фирменный знак с двумя стрелками
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* верхняя бирюзовая стрелка */}
    <path
      d="M6 12 L20 4 L34 12 L28 12 L20 7 L12 12 Z"
      fill="#1FB4A6"
    />
    {/* правая жёлтая стрелка */}
    <path
      d="M34 14 L34 28 L20 36 L20 30 L28 25 L28 14 Z"
      fill="#F6C90E"
    />
    {/* левая фиолетовая стрелка */}
    <path
      d="M6 14 L6 28 L20 36 L20 30 L12 25 L12 14 Z"
      fill="#7C3FB6"
    />
    {/* малиновый акцент */}
    <path
      d="M20 14 L26 18 L20 22 L14 18 Z"
      fill="#E0265C"
    />
  </svg>
);

export const CardsLogo = (props: SVGProps<SVGSVGElement>) => (
  // Платёжная система «Мир» — официальный зелёный знак
  <svg viewBox="0 0 64 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="0" y="0" width="64" height="24" rx="4" fill="#0F754E" />
    <text
      x="32"
      y="17"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="13"
      fontWeight="800"
      fill="#FFFFFF"
      textAnchor="middle"
      letterSpacing="0.5"
    >
      МИР
    </text>
  </svg>
);

export const SberPayLogo = (props: SVGProps<SVGSVGElement>) => (
  // SberPay — фирменный зелёный логотип Сбера + надпись Pay
  <svg viewBox="0 0 96 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(0 2)">
      {/* стилизованный «крючок» Сбера */}
      <path
        d="M18.4 4.2 A10 10 0 1 0 22 12"
        fill="none"
        stroke="#21A038"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M14 1.5 L22 1.5 L18 6 Z" fill="#21A038" />
    </g>
    <text
      x="30"
      y="17"
      fontFamily="Inter, Arial, sans-serif"
      fontSize="14"
      fontWeight="700"
      fill="#0B1F3A"
    >
      SberPay
    </text>
  </svg>
);

export const TPayLogo = (props: SVGProps<SVGSVGElement>) => (
  // T‑Pay (Tinkoff Pay) — фирменный жёлтый щит с буквой T
  <svg viewBox="0 0 80 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* щит */}
    <path
      d="M2 2 H22 V14 C22 19 14 22 12 22 C10 22 2 19 2 14 Z"
      fill="#FFDD2D"
    />
    {/* буква T */}
    <path
      d="M6 6 H18 V9 H14 V17 H10 V9 H6 Z"
      fill="#0B1F3A"
    />
    <text
      x="28"
      y="17"
      fontFamily="Inter, Arial, sans-serif"
      fontSize="14"
      fontWeight="700"
      fill="#0B1F3A"
    >
      T‑Pay
    </text>
  </svg>
);