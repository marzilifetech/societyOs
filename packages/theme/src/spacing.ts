export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// 2026 redesign geometry: soft, rounded surfaces (the Figma "RoundCard"
// language — 16-20px cards, true capsule pills, circular avatars). This
// retires the earlier flat-paper scale (2-10px, full:6) that made both apps
// read as dated: `rounded-full` is a real circle again and `rounded-2xl`
// matches the redesign card radius.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};
