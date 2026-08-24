import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside the component tree (or a top-level effect that can't rely on
// a local `navigation` prop) drive navigation imperatively — used to bounce back
// to Login the moment a session is cleared, from wherever in the app that happened.
export const navigationRef = createNavigationContainerRef();

export function resetToLogin() {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
}
