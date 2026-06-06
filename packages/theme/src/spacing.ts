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

// Paper design: surfaces are flat with minimal corner rounding. Anything
// that previously used `rounded-xl` / `rounded-2xl` / `rounded-full` gets a
// sharp paper edge instead. We intentionally retire the fully-circular
// option — capsule pills and circular avatars become slight-rounded
// rectangles to match the paper aesthetic. If a truly circular element is
// ever needed, set `borderRadius: 9999` inline at the call site.
export const radius = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  '2xl': 10,
  full: 6,
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
