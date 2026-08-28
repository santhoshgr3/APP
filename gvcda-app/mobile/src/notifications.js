import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "./api";

// Foreground behavior — without this, a notification that arrives while the
// app is open and visible is silently swallowed instead of shown as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Best-effort: called right after login/register. Requests permission (if not
// already granted/denied), gets this device's Expo push token, and registers
// it with the backend (see backend/lib/push.js) — every step swallows its own
// errors so a push-setup failure never blocks or breaks login.
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) return; // push tokens don't exist on simulators/web
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token) await api.registerPushToken(token);
  } catch (e) {
    console.error("Push registration failed:", e.message);
  }
}
