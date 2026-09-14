import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import {
  countContentLibrary,
  initializeContentLibrary,
  insertContentLibraryItem,
  listContentLibrary,
  markContentRevisited,
} from "@/lib/content-library";
import {
  CONTENT_THEMES,
  delayLabel,
  themeLabel,
  type ContentLibraryItem,
  type ContentTheme,
  type UserDelayPreference,
  USER_DELAY_OPTIONS,
} from "@/shared/content-library";
import { useColors } from "@/hooks/use-colors";

const QUICK_PROMPTS = ["فين الصورة ديال العيد؟", "جبد ليا الاقتباسات", "شنو خاصني نعاود نشوف؟"];

export default function HomeScreen() {
  const colors = useColors();
  const [items, setItems] = useState<ContentLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [theme, setTheme] = useState<ContentTheme>("other");
  const [delay, setDelay] = useState<UserDelayPreference>("decide_for_me");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (nextQuery = query) => {
    const [nextItems, nextTotal] = await Promise.all([
      listContentLibrary(nextQuery),
      countContentLibrary(),
    ]);
    setItems(nextItems);
    setTotal(nextTotal);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    initializeContentLibrary()
      .then(() => refresh(""))
      .catch(() => Alert.alert("وقع مشكل", "ما قدرناش نفتحو مكتبة الذكريات."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => refresh(query), 180);
    return () => clearTimeout(timer);
  }, [query, loading, refresh]);

  const submitMemory = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "manual_note",
        sourceUri: null,
        title: text.slice(0, 48),
        rawText: text,
        ocrText: null,
        imageContextTags: [theme],
        theme,
        capturedAt: new Date().toISOString(),
        status: "captured",
        userDelayPref: delay,
        scheduledFor: null,
      });
      setDraft("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh(query);
    } catch {
      Alert.alert("ما تسجلاتش", "عاود المحاولة من فضلك.");
    } finally {
      setSaving(false);
    }
  };

  const subtitle = useMemo(
    () => (total === 0 ? "بدا بجمع أول ذكرى ديالك" : `${total} ذكريات محفوظة محلياً`),
    [total],
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.eyebrow, { color: colors.primary }]}>ذِكْرى</Text>
                  <Text style={[styles.title, { color: colors.foreground }]}>خلي الحاجة ترجع ليك فوقتها</Text>
                  <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
                </View>
                <View style={[styles.logo, { backgroundColor: colors.primary }]}>
                  <Text style={styles.logoText}>ذ</Text>
                </View>
              </View>

              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="سول بالدارجة على شي ذكرى..."
                  placeholderTextColor={colors.muted}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  textAlign="right"
                  returnKeyType="search"
                />
              </View>

              <View style={styles.promptRow}>
                {QUICK_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => setQuery(prompt)}
                    style={({ pressed }) => [
                      styles.prompt,
                      { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}55` },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.promptText, { color: colors.primary }]}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.captureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeadingRow}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>زيد ذكرى دابا</Text>
                  <Text style={styles.cardEmoji}>✦</Text>
                </View>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="لسّق رابط، كتب اقتباس، ولا وصف الصورة..."
                  placeholderTextColor={colors.muted}
                  style={[styles.noteInput, { color: colors.foreground, borderColor: colors.border }]}
                  multiline
                  textAlign="right"
                />
                <View style={styles.sectionLabelRow}>
                  <Text style={[styles.sectionLabel, { color: colors.muted }]}>التصنيف</Text>
                  <Text style={[styles.sectionLabel, { color: colors.muted }]}>وقت الرجوع</Text>
                </View>
                <View style={styles.optionRow}>
                  <FlatList
                    horizontal
                    inverted
                    data={CONTENT_THEMES}
                    keyExtractor={(value) => value}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item: value }) => (
                      <Pressable
                        onPress={() => setTheme(value)}
                        style={[
                          styles.option,
                          { borderColor: theme === value ? colors.primary : colors.border },
                          theme === value && { backgroundColor: `${colors.primary}22` },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: theme === value ? colors.primary : colors.muted }]}>
                          {themeLabel[value]}
                        </Text>
                      </Pressable>
                    )}
                  />
                </View>
                <View style={styles.optionRow}>
                  <FlatList
                    horizontal
                    inverted
                    data={USER_DELAY_OPTIONS}
                    keyExtractor={(value) => value}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item: value }) => (
                      <Pressable
                        onPress={() => setDelay(value)}
                        style={[
                          styles.option,
                          { borderColor: delay === value ? colors.primary : colors.border },
                          delay === value && { backgroundColor: `${colors.primary}22` },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: delay === value ? colors.primary : colors.muted }]}>
                          {delayLabel[value]}
                        </Text>
                      </Pressable>
                    )}
                  />
                </View>
                <Pressable
                  onPress={submitMemory}
                  disabled={saving || !draft.trim()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    (pressed || saving) && styles.pressed,
                    !draft.trim() && styles.disabled,
                  ]}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>حفظ فالمكتبة المحلية</Text>}
                </Pressable>
              </View>

              <View style={styles.listHeading}>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>آخر الذكريات</Text>
                <Text style={[styles.listHint, { color: colors.muted }]}>Private by default</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? <ActivityIndicator color={colors.primary} style={styles.empty} /> : (
              <Text style={[styles.emptyText, { color: colors.muted }]}>ما لقيت حتى ذكرى بهاد البحث.</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={async () => {
                await markContentRevisited(item.id);
                await refresh(query);
              }}
              style={({ pressed }) => [
                styles.memoryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.memoryIcon, { backgroundColor: `${colors.primary}1c` }]}>
                <Text style={styles.memoryIconText}>{item.sourceType === "manual_note" ? "✎" : "◈"}</Text>
              </View>
              <View style={styles.memoryBody}>
                <Text style={[styles.memoryTheme, { color: colors.primary }]}>{themeLabel[item.theme]}</Text>
                <Text style={[styles.memoryTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.title || "ذكرى بلا عنوان"}
                </Text>
                <Text style={[styles.memoryText, { color: colors.muted }]} numberOfLines={2}>
                  {item.rawText || item.ocrText || "مازال ما تزاد حتى وصف."}
                </Text>
                <Text style={[styles.memoryMeta, { color: colors.muted }]}>
                  {item.revisitCount > 0 ? `رجعتي ليها ${item.revisitCount} مرات` : delayLabel[item.userDelayPref]}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  eyebrow: { fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 5 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "800", textAlign: "right", maxWidth: 280 },
  subtitle: { fontSize: 13, textAlign: "right", marginTop: 6 },
  logo: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 25, fontWeight: "900" },
  searchBox: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 14, minHeight: 52, flexDirection: "row-reverse", alignItems: "center", marginBottom: 13 },
  searchIcon: { fontSize: 25, color: "#9BA1A6", marginLeft: 8 },
  searchInput: { flex: 1, fontSize: 14, minHeight: 46 },
  promptRow: { flexDirection: "row-reverse", gap: 7, marginBottom: 18 },
  prompt: { borderWidth: 1, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10 },
  promptText: { fontSize: 11, fontWeight: "700" },
  captureCard: { borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 24 },
  cardHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" },
  cardEmoji: { color: "#F59E0B", fontSize: 20 },
  noteInput: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 72, fontSize: 13, textAlignVertical: "top", marginBottom: 14 },
  sectionLabelRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 7 },
  sectionLabel: { fontSize: 11, fontWeight: "700" },
  optionRow: { marginBottom: 10 },
  option: { borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, marginLeft: 7 },
  optionText: { fontSize: 11, fontWeight: "600" },
  primaryButton: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  listHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  listTitle: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  listHint: { fontSize: 10 },
  memoryCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row-reverse", gap: 12, marginBottom: 10 },
  memoryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  memoryIconText: { color: "#F59E0B", fontSize: 20 },
  memoryBody: { flex: 1, alignItems: "flex-end" },
  memoryTheme: { fontSize: 10, fontWeight: "800", marginBottom: 3 },
  memoryTitle: { fontSize: 14, fontWeight: "800", width: "100%", textAlign: "right" },
  memoryText: { fontSize: 12, lineHeight: 18, width: "100%", textAlign: "right", marginTop: 4 },
  memoryMeta: { fontSize: 10, width: "100%", textAlign: "right", marginTop: 5 },
  empty: { paddingVertical: 24 },
  emptyText: { textAlign: "center", paddingVertical: 24, fontSize: 13 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
