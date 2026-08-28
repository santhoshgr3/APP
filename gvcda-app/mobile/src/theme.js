// Same palette as the web app's src/ui.jsx — keep both in sync if you rebrand.
export const T = {
  teal: "#0E5E5C",
  tealDark: "#093F3E",
  tealLight: "#EAF3F2",
  terracotta: "#C1652F",
  terracottaLight: "#F7E7DB",
  gold: "#D4A017",
  goldLight: "#FBF1DA",
  red: "#B23A48",
  redLight: "#F7E4E6",
  green: "#4C7A3D",
  greenLight: "#E9F1E5",
  blue: "#2E6B8A",
  blueLight: "#E5EFF3",
  purple: "#7A4C87",
  purpleLight: "#F1E7F3",
  cream: "#FBF7F0",
  ink: "#1E2523",
  inkSoft: "#5B655F",
  line: "#E7E0D3",
  white: "#FFFFFF",
};

// Retailer sector categories are seeded fixed (backend/db.js) — give each a
// distinct color + Feather icon name so browsing isn't a grid of identical
// white boxes. An unlisted category falls back to teal/store.
const CATEGORY_STYLE = {
  Agriculture: { color: "green", icon: "sunrise" },
  Business: { color: "blue", icon: "briefcase" },
  Education: { color: "purple", icon: "book-open" },
  Electronics: { color: "gold", icon: "zap" },
  Employment: { color: "teal", icon: "users" },
  Grocery: { color: "terracotta", icon: "shopping-cart" },
  Health: { color: "red", icon: "activity" },
  Services: { color: "blue", icon: "tool" },
};
export function categoryStyle(name) {
  return CATEGORY_STYLE[name] || { color: "teal", icon: "shopping-bag" };
}
