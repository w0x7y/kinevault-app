export const lightColors = {
  background: "#f6f7f9",
  foreground: "#192026",
  card: "#ffffff",
  primary: "#314e65",
  primaryForeground: "#ffffff",
  secondary: "#e9edf1",
  secondaryForeground: "#314e65",
  muted: "#e9edf1",
  mutedForeground: "#52606d",
  accent: "#e3ebf1",
  accentForeground: "#243f55",
  border: "#ced6de",
  input: "#ced6de",
  ring: "#638ba6",
  error: "#991b1b",
  errorBackground: "#fef2f2",
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: "#12171d",
  foreground: "#e5eaf0",
  card: "#1a222b",
  primary: "#94bdd7",
  primaryForeground: "#10181f",
  secondary: "#25313d",
  secondaryForeground: "#d7e6f2",
  muted: "#25313d",
  mutedForeground: "#b0bdca",
  accent: "#253747",
  accentForeground: "#d7e6f2",
  border: "#3b4a59",
  input: "#3b4a59",
  ring: "#94bdd7",
  error: "#fca5a5",
  errorBackground: "#3b1c23",
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  control: 14,
  panel: 18,
  largePanel: 22,
};
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  panel: 24,
  section: 32,
  large: 40,
};
export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
};
