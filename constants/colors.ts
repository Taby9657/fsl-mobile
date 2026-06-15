// FSL Design System – barvy z prototypu
export const Colors = {
  bg:   '#0D0120',   // pozadí
  c1:   '#1A0535',   // karta 1
  c2:   '#240A48',   // karta 2
  bd:   'rgba(201,161,64,0.22)', // border
  go:   '#C9A140',   // gold – akcent
  pu:   '#8B5CF6',   // purple
  mu:   '#9B8BC8',   // muted
  di:   '#7B6BA8',   // disabled
  wh:   '#F0E8FF',   // text
  red:  '#EF4444',
  green:'#22C55E',
  white:'#FFFFFF',
} as const;

export const Fonts = {
  regular: undefined, // systémový font
  sizes: {
    xs:  11,
    sm:  13,
    md:  15,
    lg:  17,
    xl:  20,
    xxl: 24,
    h1:  28,
  }
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;
