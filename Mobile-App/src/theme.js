import { Platform } from "react-native";

/**
 * Design tokens ported 1:1 from the web `/mobile` route (index.css MOBILE DARK SYSTEM).
 * Keep these hex values identical to the web app so the native app stays pixel-faithful.
 */
export const colors = {
  bg: "#0A0A0A",
  surface: "#141414",
  surface2: "#1A1A1A",
  chip: "#1F1F1F",
  border: "#232323",
  borderSoft: "#2A2A2A",
  hairline: "#232323",
  hairlineSoft: "#1C1C1C",

  text: "#F5F0E5",
  textDim: "#C8C1B0",
  muted: "#8E887D",
  faint: "#5A554B",

  cream: "#F5F0E5",
  ink: "#0A0A0A",

  brand: "#FF7E6B",
  brandText: "#FF9B7E",

  success: "#5BC97E",
  successDeep: "#1F7A3D",
  amber: "#FFB661",
  amberDeep: "#B8860B",
  danger: "#FF9B7E",
  dangerDeep: "#8B2424",

  glass: "rgba(10,10,10,0.82)",
};

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
export const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

export const radius = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
};
