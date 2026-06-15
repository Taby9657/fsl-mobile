/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg:  '#0D0120',
        c1:  '#1A0535',
        c2:  '#240A48',
        go:  '#C9A140',
        pu:  '#8B5CF6',
        mu:  '#9B8BC8',
        di:  '#7B6BA8',
        wh:  '#F0E8FF',
      },
    },
  },
};
