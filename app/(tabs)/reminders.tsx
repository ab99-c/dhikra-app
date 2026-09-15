import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  attachNotificationToItem,
  listContentLibrary,
  updateContentSchedule,
  updateContentStatus,
} from "@/lib/content-library";
import { scheduleDhikraReminder, cancelDhikraReminder } from "@/lib/reminders";
import { useColors } from "@/hooks/use-colors";
import type { ContentLibraryItem } from "@/shared/content-library";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو",
  "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر",
];

function formatDhikraDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ${hours}:${minutes}`;
}

export default function RemindersScreen() {
  const colors = useColors();
  const [upcoming, setUpcoming] = useState<ContentLibraryItem[]>([]);
  const [done, setDone] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const items = await listContentLibrary("");
    setUpcoming(
      items
        .filter((item) => item.status === "queued" && item.scheduledFor)
        .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "")),
    );
    setDone(
      items
        .filter((item) => item.status === "completed" || item.status === "dismissed")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      refresh()
        .catch(() => Alert.alert("وقع مشكل", "ما قدرناش نجيبو التذكيرات."))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const completeReminder = async (item: ContentLibraryItem) => {
    if (busyId !== null) return;
    setBusyId(item.id);
    try {
      await updateContentStatus(item.id, "completed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("ما تسجلاتش", "عاود المحاولة من فضلك.");
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  const dismissReminder = async (item: ContentLibraryItem) => {
    if (busyId !== null) return;
    setBusyId(item.id);
    try {
      if (item.notificationId) {
        await cancelDhikraReminder(item.notificationId);
      }
      await updateContentStatus(item.id, "dismissed");
    } catch {
      Alert.alert("ما تلغاتش", "عاود المحاولة من فضلك.");
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  // Re-schedules a dismissed/completed reminder for "tomorrow at 10:00" via
  // the same scheduler path used by the chatbot flow.
  const rescheduleReminder = async (item: ContentLibraryItem) => {
    if (busyId !== null) return;
    setBusyId(item.id);
    try {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(10, 0, 0, 0);
      const dateIso = next.toISOString();
      await updateContentStatus(item.id, "queued");
      await updateContentSchedule(item.id, dateIso);
      const notificationId = await scheduleDhikraReminder({
        title: "ذِكْرى — وقت المراجعة",
        body: item.title || item.rawText || "ذكرى",
        dateIso,
        memoryId: item.id,
      });
      await attachNotificationToItem(item.id, notificationId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("ما تبرمجتش", "عاود المحاولة من فضلك.");
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <FlatList
        data={upcoming}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>ذِكْرى</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>التذكيرات</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  {upcoming.length === 0
                    ? "ما كاين حتى تذكير مبرمج"
                    : `${upcoming.length} ${upcoming.length === 1 ? "تذكير" : "تذكيرات"} قادمة`}
                </Text>
              </View>
              <View style={[styles.logo, { backgroundColor: colors.primary }]}>
                <Text style={styles.logoText}>🔔</Text>
              </View>
            </View>
            {upcoming.length > 0 && (
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>القادمة</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.empty} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              ما كاين حتى تذكير مبرمج.{"\n"}سول الـ chatbot على الذكرى وقال ليه «نعاود نشوفها غدا» — غادي يبان هنا.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.reminderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.reminderIcon, { backgroundColor: `${colors.primary}1c` }]}>
              <Text style={styles.reminderIconText}>🔔</Text>
            </View>
            <View style={styles.reminderBody}>
              <Text style={[styles.reminderTitle, { color: colors.foreground }]} numberOfLines={1}>
                {item.title || "تذكير بلا عنوان"}
              </Text>
              {item.rawText ? (
                <Text style={[styles.reminderText, { color: colors.muted }]} numberOfLines={2}>
                  {item.rawText}
                </Text>
              ) : null}
              <Text style={[styles.reminderDate, { color: colors.primary }]}>
                {formatDhikraDate(item.scheduledFor || "")}
              </Text>
              <View style={styles.reminderActions}>
                <Pressable
                  onPress={() => completeReminder(item)}
                  disabled={busyId !== null}
                  style={[styles.actionButton, { backgroundColor: colors.success }]}
                >
                  {busyId === item.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionText}>تمّت</Text>}
                </Pressable>
                <Pressable
                  onPress={() => dismissReminder(item)}
                  disabled={busyId !== null}
                  style={[styles.actionButton, { borderColor: colors.error, borderWidth: 1 }]}
                >
                  <Text style={[styles.actionText, { color: colors.error }]}>لغّيها</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          done.length > 0 ? (
            <View style={styles.doneSection}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>المكتملة والملغية</Text>
              {done.map((item) => (
                <View key={String(item.id)} style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.doneBody}>
                    <Text style={[styles.doneTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title || "تذكير"}
                    </Text>
                    {item.scheduledFor ? (
                      <Text style={[styles.doneDate, { color: colors.muted }]}>
                        كان مبرمج لـ {formatDhikraDate(item.scheduledFor)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.doneStatus, { color: item.status === "completed" ? colors.success : colors.error }]}>
                    {item.status === "completed" ? "✓ تمّت" : "✕ ملغية"}
                  </Text>
                  <Pressable
                    onPress={() => rescheduleReminder(item)}
                    disabled={busyId !== null}
                    style={[styles.rescheduleButton, { borderColor: colors.primary, borderWidth: 1 }]}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text style={[styles.rescheduleText, { color: colors.primary }]}>عاود برمجها</Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 },
  eyebrow: { fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 5 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "800", textAlign: "right" },
  subtitle: { fontSize: 13, textAlign: "right", marginTop: 6 },
  logo: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 22 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textAlign: "right", marginBottom: 10 },
  reminderCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row-reverse", gap: 12, marginBottom: 10 },
  reminderIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  reminderIconText: { fontSize: 18 },
  reminderBody: { flex: 1, alignItems: "flex-end" },
  reminderTitle: { fontSize: 14, fontWeight: "800", width: "100%", textAlign: "right" },
  reminderText: { fontSize: 12, lineHeight: 18, width: "100%", textAlign: "right", marginTop: 4 },
  reminderDate: { fontSize: 11, fontWeight: "800", width: "100%", textAlign: "right", marginTop: 6 },
  reminderActions: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  actionButton: { minHeight: 34, minWidth: 74, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  actionText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  doneSection: { marginTop: 16 },
  doneCard: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  doneBody: { flex: 1, alignItems: "flex-end" },
  doneTitle: { fontSize: 13, fontWeight: "700", width: "100%", textAlign: "right" },
  doneDate: { fontSize: 10, width: "100%", textAlign: "right", marginTop: 3 },
  doneStatus: { fontSize: 10, fontWeight: "800" },
  rescheduleButton: { minHeight: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  rescheduleText: { fontSize: 10, fontWeight: "800" },
  empty: { paddingVertical: 24 },
  emptyText: { textAlign: "center", paddingVertical: 24, fontSize: 13, lineHeight: 21 },
});
