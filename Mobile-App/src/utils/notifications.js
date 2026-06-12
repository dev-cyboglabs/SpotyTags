import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";

try {
  // Configure how notifications are handled when the app is open
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn("Could not set notification handler:", e);
}

export async function registerForPushNotificationsAsync() {
  let token;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.warn("Failed to get push token for push notifications!");
        return null;
      }
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;
        if (!projectId || projectId === "placeholder-id") {
          console.log("Push notifications fallback: no EAS projectId configured in app.json. Skipping remote token registration. Local real-time system alerts will be used.");
          return null;
        }
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (error) {
        console.warn("Error retrieving Expo push token:", error);
      }
    } else {
      console.warn("Must use a physical device for push notifications.");
    }
  } catch (err) {
    console.warn("Bypassed notification setup exception:", err);
  }

  return token;
}

export async function registerAndSubmitPushToken() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      console.log("Submitting push token to backend:", token);
      await api.post("/users/push-token", { token });
    }
  } catch (err) {
    console.warn("Failed to register and submit push token:", err);
  }
}
