const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      ...require('@societyos/theme/tailwind').tailwindThemeExtend,
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [],
};
