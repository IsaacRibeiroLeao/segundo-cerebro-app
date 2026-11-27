import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHAVE = "sc_lembrete_v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function lembreteAtivo() {
  return (await AsyncStorage.getItem(CHAVE)) === "1";
}

// Weekly reminder: domingo às 18h para fazer a revisão.
export async function ligarLembrete(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("revisao", {
      name: "Weekly review",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const atual = await Notifications.getPermissionsAsync();
  const perm = atual.granted ? atual : await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: "Weekly review", body: "Want to see what the Lord has been saying to you this week?" },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0, channelId: "revisao" },
  });
  await AsyncStorage.setItem(CHAVE, "1");
  return true;
}

export async function desligarLembrete() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(CHAVE, "0");
}
