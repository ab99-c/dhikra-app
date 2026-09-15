import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let configured = false;

async function configureNotifications() {
  if (configured) return true;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("dhikra-reminders", {
      name: "ذِكْرى reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0a7ea4",
    });
  }
  const permissions = await Notifications.getPermissionsAsync();
  const finalStatus = permissions.status === "granted"
    ? permissions.status
    : (await Notifications.requestPermissionsAsync()).status;
  configured = finalStatus === "granted";
  return configured;
}

export async function scheduleDhikraReminder(input: { title: string; body: string; dateIso: string; memoryId?: number | null }) {
  const date = new Date(input.dateIso);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new Error("Reminder date must be in the future.");
  }
  if (!(await configureNotifications())) {
    throw new Error("Notification permission was not granted.");
  }
  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: "default",
      data: { memoryId: input.memoryId ?? null, source: "dhikra" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: "dhikra-reminders",
    },
  });
}

export async function cancelDhikraReminder(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
  return `cancelled-${notificationId}`;
}
