import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  attachNotificationToItem,
  countContentLibrary,
  initializeContentLibrary,
  insertContentLibraryItem,
  listContentLibrary,
  markContentRevisited,
  updateContentMetadata,
} from "@/lib/content-library";
import {
  readScreenshotBase64,
  readImageUriBase64,
  scanRecentScreenshots,
  type DetectedScreenshot,
} from "@/lib/screenshots";
import { subscribeToScreenshots } from "@/lib/screenshot-watcher";
import { DELAY_PRESETS_MS, planNextReminder } from "@/shared/timing-engine";
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
import { trpc } from "@/lib/trpc";
import type { AssistantResponse } from "@/shared/assistant";
import { scheduleDhikraReminder } from "@/lib/reminders";
import type { ImageAnalysis } from "@/server/_core/imageAnalysis";
import { loadMoodSettings, setCameraEmotionEnabled, setMood, type MoodSettings } from "@/lib/mood-settings";
import { detectMoodFromText, moodEmoji, moodLabel, rankItemsForMood, type MoodState } from "@/shared/mood";

const QUICK_PROMPTS = ["فين الصورة ديال العيد؟", "جبد ليا الاقتباسات", "شنو خاصني نعاود نشوف؟"];

export default function HomeScreen() {
  const colors = useColors();
  const [items, setItems] = useState<ContentLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [theme, setTheme] = useState<ContentTheme>("other");
  const [delay, setDelay] = useState<UserDelayPreference>("decide_for_me");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const [chatAnswer, setChatAnswer] = useState<AssistantResponse | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [shots, setShots] = useState<DetectedScreenshot[]>([]);
  const [shotsLoading, setShotsLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<{ uri: string; filename: string; analysis: ImageAnalysis } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState("");
  const [editTheme, setEditTheme] = useState<ContentTheme>("other");
  const [moodSettings, setMoodSettings] = useState<MoodSettings | null>(null);
  const [moodCheckinOpen, setMoodCheckinOpen] = useState(false);
  const chatMutation = trpc.assistant.chat.useMutation();
  const analyzeMutation = trpc.content.analyzeImage.useMutation();

  const refresh = useCallback(async (nextQuery = query) => {
    const [nextItems, nextTotal] = await Promise.all([
      listContentLibrary(nextQuery),
      countContentLibrary(),
    ]);
    setItems(moodSettings?.mood ? rankItemsForMood(nextItems, moodSettings.mood, moodSettings.mapping) : nextItems);
    setTotal(nextTotal);
  }, [query, moodSettings]);

  const refreshScreenshots = useCallback(async () => {
    if (Platform.OS === "web") return;
    setShotsLoading(true);
    try {
      setShots(await scanRecentScreenshots({ limit: 10 }));
    } catch {
      // Permissions refused or media library unavailable — stay quiet.
    } finally {
      setShotsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshScreenshots();
    }, [refreshScreenshots]),
  );

  // Native watcher (dev builds): re-scan as soon as a new screenshot lands,
  // even when the user comes back from another app.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const unsubscribe = subscribeToScreenshots(() => {
      refreshScreenshots();
    });
    return () => unsubscribe?.();
  }, [refreshScreenshots]);

  useEffect(() => {
    let mounted = true;
    Promise.all([initializeContentLibrary(), loadMoodSettings()])
      .then(([, settings]) => {
        if (mounted) setMoodSettings(settings);
        return refresh("");
      })
      .catch(() => Alert.alert("وقع مشكل", "ما قدرناش نفتحو مكتبة الذكريات."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const chooseMood = async (nextMood: MoodState) => {
    const settings = await setMood(nextMood);
    setMoodSettings(settings);
    setMoodCheckinOpen(false);
    await refresh(query);
  };

  const updateMoodFromDraft = (text: string) => {
    setDraft(text);
    if (text.trim().length >= 12) {
      const inferred = detectMoodFromText(text);
      if (inferred !== "neutral" && moodSettings?.mood !== inferred) void chooseMood(inferred);
    }
  };

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
      const history = await listContentLibrary("");
      const plan = planNextReminder(history, new Date());
      const scheduledFor =
        delay === "decide_for_me"
          ? plan.scheduledForIso
          : new Date(Date.now() + DELAY_PRESETS_MS[delay]).toISOString();
      const id = await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "manual_note",
        sourceUri: null,
        title: text.slice(0, 48),
        rawText: text,
        ocrText: null,
        imageContextTags: [theme],
        theme,
        capturedAt: new Date().toISOString(),
        status: "queued",
        userDelayPref: delay,
        scheduledFor,
      });
      await scheduleDhikraReminder({
        title: "ذِكْرى — وقت المراجعة",
        body: text.slice(0, 120),
        dateIso: scheduledFor,
        memoryId: id,
      }).then((notificationId) => attachNotificationToItem(id, notificationId));
      setDraft("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh(query);
    } catch {
      Alert.alert("ما تسجلاتش", "عاود المحاولة من فضلك.");
    } finally {
      setSaving(false);
    }
  };

  const saveScreenshot = async (shot: DetectedScreenshot) => {
    try {
      const existing = await listContentLibrary("");
      if (existing.some((item) => item.sourceUri === shot.uri)) {
        setShots((prev) => prev.filter((candidate) => candidate.id !== shot.id));
        return;
      }
      const plan = planNextReminder(existing, new Date());
      const id = await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "screenshot",
        sourceUri: shot.uri,
        title: shot.filename || "لقطة شاشة",
        rawText: `لقطة شاشة: ${shot.filename || "بدون اسم"}`,
        ocrText: null,
        imageContextTags: ["screenshot"],
        theme: "other",
        capturedAt: new Date(shot.createdAt).toISOString(),
        status: "queued",
        userDelayPref: "decide_for_me",
        scheduledFor: plan.scheduledForIso,
      });
      await scheduleDhikraReminder({
        title: "ذِكْرى — وقت المراجعة",
        body: "اللقطة ديالك فـ الانتظار",
        dateIso: plan.scheduledForIso,
        memoryId: id,
      }).then((notificationId) => attachNotificationToItem(id, notificationId));
      setShots((prev) => prev.filter((candidate) => candidate.id !== shot.id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh(query);
    } catch {
      Alert.alert("ما تسجلاتش", "عاود المحاولة من فضلك.");
    }
  };

  const analyzeScreenshot = async (shot: DetectedScreenshot) => {
    if (analyzingId) return;
    setAnalyzingId(shot.id);
    try {
      const { base64, mimeType } = await readScreenshotBase64(shot);
      const analysis = await analyzeMutation.mutateAsync({ base64, mimeType });
      const existing = await listContentLibrary("");
      if (existing.some((item) => item.sourceUri === shot.uri)) {
        setShots((prev) => prev.filter((candidate) => candidate.id !== shot.id));
        return;
      }
      const scheduledFor =
        analysis.suggestedDelay === "decide_for_me"
          ? planNextReminder(existing, new Date()).scheduledForIso
          : new Date(Date.now() + DELAY_PRESETS_MS[analysis.suggestedDelay]).toISOString();
      const id = await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "screenshot",
        sourceUri: shot.uri,
        title: analysis.title || shot.filename || "لقطة شاشة",
        rawText: analysis.ocrText,
        ocrText: analysis.ocrText,
        imageContextTags: [...analysis.tags, "screenshot"],
        theme: analysis.theme,
        capturedAt: new Date(shot.createdAt).toISOString(),
        status: "queued",
        userDelayPref: analysis.suggestedDelay,
        scheduledFor,
      });
      await scheduleDhikraReminder({
        title: "ذِكْرى — وقت المراجعة",
        body: analysis.title || analysis.ocrText.slice(0, 120),
        dateIso: scheduledFor,
        memoryId: id,
      }).then((notificationId) => attachNotificationToItem(id, notificationId));
      setShots((prev) => prev.filter((candidate) => candidate.id !== shot.id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh(query);
    } catch {
      Alert.alert("التحليل ما خدمش", "تأكد من الاتصال بالـbackend وعاود المحاولة.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const askAssistant = async () => {
    const question = chatQuery.trim();
    if (!question || chatMutation.isPending) return;
    try {
      const matchingMemories = await listContentLibrary(question);
      const context = matchingMemories.length > 0 ? matchingMemories : await listContentLibrary("");
      const answer = await chatMutation.mutateAsync({
        query: question,
        memories: context.slice(0, 12).map(({ id, title, rawText, ocrText, theme, capturedAt, status, scheduledFor }) => ({
          id,
          title,
          rawText,
          ocrText,
          theme,
          capturedAt,
          status,
          scheduledFor,
        })),
      });
      setChatAnswer(answer);
    } catch {
      Alert.alert("الشات ما خدمش", "تأكد من الاتصال بالـbackend وعاود المحاولة.");
    }
  };

  const saveReminder = async () => {
    if (!chatAnswer?.dateIso || savingReminder) return;
    setSavingReminder(true);
    try {
      const id = await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "chat_reminder",
        sourceUri: null,
        title: chatAnswer.reminderTitle || chatQuery.slice(0, 48),
        rawText: chatQuery,
        ocrText: null,
        imageContextTags: ["reminder", "chat"],
        theme: "other",
        capturedAt: new Date().toISOString(),
        status: "queued",
        userDelayPref: "decide_for_me",
        scheduledFor: chatAnswer.dateIso,
      });
      await scheduleDhikraReminder({
        title: "ذِكْرى — وقت المراجعة",
        body: chatAnswer.reminderTitle || chatQuery,
        dateIso: chatAnswer.dateIso,
        memoryId: id,
      }).then((notificationId) => attachNotificationToItem(id, notificationId));
      await refresh(query);
      Alert.alert("تسجّل التذكير", "غادي يوصلك إشعار فـ الوقت اللي فهمو chatbot.");
    } catch (error) {
      Alert.alert("ما قدرناش نبرمجوه", error instanceof Error ? error.message : "عاود المحاولة من بعد.");
    } finally {
      setSavingReminder(false);
    }
  };

  const pickGalleryImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAnalyzingId("gallery");
    try {
      const { base64, mimeType } = await readImageUriBase64(asset.uri);
      const analysis = await analyzeMutation.mutateAsync({ base64, mimeType });
      setPendingAnalysis({ uri: asset.uri, filename: asset.fileName || "صورة من المعرض", analysis });
    } catch {
      Alert.alert("التحليل ما خدمش", "تأكد من الاتصال بالـbackend وعاود المحاولة.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const savePendingImage = async () => {
    if (!pendingAnalysis) return;
    const { uri, filename, analysis } = pendingAnalysis;
    try {
      const existing = await listContentLibrary("");
      const scheduledFor = analysis.suggestedDelay === "decide_for_me"
        ? planNextReminder(existing, new Date()).scheduledForIso
        : new Date(Date.now() + DELAY_PRESETS_MS[analysis.suggestedDelay]).toISOString();
      const id = await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "gallery_image",
        sourceUri: uri,
        title: analysis.title || filename,
        rawText: analysis.summary || analysis.ocrText,
        ocrText: analysis.ocrText,
        imageContextTags: [...analysis.tags, "image", "gallery"],
        theme: analysis.theme,
        capturedAt: new Date().toISOString(),
        status: "queued",
        userDelayPref: analysis.suggestedDelay,
        scheduledFor,
      });
      await scheduleDhikraReminder({
        title: "ذِكْرى — وقت المراجعة",
        body: analysis.summary || analysis.title || "صورة محللة بالذكاء الاصطناعي",
        dateIso: scheduledFor,
        memoryId: id,
      }).then((notificationId) => attachNotificationToItem(id, notificationId));
      await refresh(query);
      setPendingAnalysis(null);
      Alert.alert("تحفظات الصورة", analysis.summary || analysis.title || "تزادت الصورة للمكتبة.");
    } catch {
      Alert.alert("ما تحفظاتش الصورة", "عاود المحاولة من فضلك.");
    }
  };

  const saveLink = async () => {
    const url = linkDraft.trim();
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("الرابط ناقص", "دخل رابط كيبدا بـ https://");
      return;
    }
    try {
      const parsed = new URL(url);
      await insertContentLibraryItem({
        userId: "local-user",
        sourceType: "link",
        sourceUri: url,
        title: parsed.hostname.replace(/^www\./, ""),
        rawText: url,
        ocrText: null,
        imageContextTags: ["link", parsed.hostname],
        theme: "article",
        capturedAt: new Date().toISOString(),
        status: "captured",
        userDelayPref: "decide_for_me",
        scheduledFor: null,
      });
      setLinkDraft("");
      await refresh(query);
    } catch {
      Alert.alert("الرابط غير صالح", "تأكد من الرابط وعاود المحاولة.");
    }
  };

  const beginEditMetadata = (item: ContentLibraryItem) => {
    setEditingId(item.id);
    setEditTheme(item.theme);
    setEditTags(item.imageContextTags.join(", "));
  };

  const saveMetadata = async () => {
    if (editingId === null) return;
    await updateContentMetadata(editingId, {
      theme: editTheme,
      imageContextTags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
    });
    setEditingId(null);
    await refresh(query);
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
              <View style={[styles.moodCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.moodHeading}>
                  <View>
                    <Text style={[styles.moodTitle, { color: colors.foreground }]}>كيف داير دابا؟</Text>
                    <Text style={[styles.moodHint, { color: colors.muted }]}>اختيارك كيبقى محلي وكيعاوننا نطلعولك الذكرى المناسبة.</Text>
                  </View>
                  <Text style={styles.moodEmoji}>{moodSettings?.mood ? moodEmoji[moodSettings.mood] : "◌"}</Text>
                </View>
                <Pressable onPress={() => setMoodCheckinOpen((open) => !open)} style={[styles.moodButton, { borderColor: colors.primary }]}>
                  <Text style={[styles.moodButtonText, { color: colors.primary }]}>{moodSettings?.mood ? `دابا: ${moodLabel[moodSettings.mood]}` : "دير check-in سريع"}</Text>
                </Pressable>
                {moodCheckinOpen && (
                  <View style={styles.moodOptions}>
                    {(["stressed", "low", "neutral", "joyful"] as MoodState[]).map((value) => (
                      <Pressable key={value} onPress={() => chooseMood(value)} style={[styles.moodOption, { borderColor: moodSettings?.mood === value ? colors.primary : colors.border }]}>
                        <Text style={styles.moodOptionEmoji}>{moodEmoji[value]}</Text>
                        <Text style={[styles.moodOptionText, { color: colors.foreground }]}>{moodLabel[value]}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={styles.privacyRow}>
                  <Text style={[styles.privacyText, { color: colors.muted }]}>الكاميرا مطفّية: ما كاين لا تصوير لا إرسال للوجه.</Text>
                  <Switch value={moodSettings?.cameraEmotionEnabled ?? false} onValueChange={async (enabled) => setMoodSettings(await setCameraEmotionEnabled(enabled))} disabled />
                </View>
              </View>

              <Pressable
                onPress={() => setChatOpen((value) => !value)}
                style={({ pressed }) => [styles.chatToggle, { backgroundColor: colors.primary }, pressed && styles.pressed]}
              >
                <Text style={styles.chatToggleText}>{chatOpen ? "سد chatbot" : "سول ذِكْرى على شي حاجة"}</Text>
                <Text style={styles.chatToggleIcon}>✦</Text>
              </Pressable>

              {chatOpen && (
                <View style={[styles.chatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.chatTitle, { color: colors.foreground }]}>Chatbot بالدارجة + RAG</Text>
                  <Text style={[styles.chatHint, { color: colors.muted }]}>يبحث فذكرياتك المختارة ويفهم أسئلة بحال: «وقتاش نعاود نشوف هادشي؟»</Text>
                  <View style={styles.chatComposer}>
                    <TextInput
                      value={chatQuery}
                      onChangeText={setChatQuery}
                      placeholder="مثال: فاش نعاود نشوف هاد المقال؟"
                      placeholderTextColor={colors.muted}
                      style={[styles.chatInput, { color: colors.foreground, borderColor: colors.border }]}
                      textAlign="right"
                      multiline
                    />
                    <Pressable onPress={askAssistant} disabled={!chatQuery.trim() || chatMutation.isPending} style={[styles.chatSend, { backgroundColor: colors.primary }]}>
                      {chatMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.chatSendText}>سول</Text>}
                    </Pressable>
                  </View>
                  {chatAnswer && (
                    <View style={[styles.answerBox, { borderColor: `${colors.primary}55` }]}>
                      <Text style={[styles.answerText, { color: colors.foreground }]}>{chatAnswer.reply}</Text>
                      {chatAnswer.dateIso && <Text style={[styles.answerDate, { color: colors.primary }]}>التاريخ المقترح: {chatAnswer.dateText || chatAnswer.dateIso}</Text>}
                      {chatAnswer.intent === "create_reminder" && <Text style={[styles.answerDate, { color: colors.success }]}>فهمت بلي بغيتي تذكير: {chatAnswer.reminderTitle || "ذكرى"}</Text>}
                      {chatAnswer.dateIso && <Pressable onPress={saveReminder} disabled={savingReminder} style={[styles.reminderButton, { backgroundColor: colors.primary }]}>
                        {savingReminder ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.reminderButtonText}>برمج التذكير</Text>}
                      </Pressable>}
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.captureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeadingRow}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>زيد ذكرى دابا</Text>
                  <Text style={styles.cardEmoji}>✦</Text>
                </View>
                <TextInput
                  value={draft}
                  onChangeText={updateMoodFromDraft}
                  placeholder="لسّق رابط، كتب اقتباس، ولا وصف الصورة..."
                  placeholderTextColor={colors.muted}
                  style={[styles.noteInput, { color: colors.foreground, borderColor: colors.border }]}
                  multiline
                  textAlign="right"
                />
                <View style={styles.captureActions}>
                  <Pressable onPress={pickGalleryImage} style={[styles.secondaryButton, { borderColor: colors.primary }]}>
                    <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>اختار صورة</Text>
                  </Pressable>
                  <View style={styles.linkComposer}>
                    <TextInput
                      value={linkDraft}
                      onChangeText={setLinkDraft}
                      placeholder="https://..."
                      placeholderTextColor={colors.muted}
                      style={[styles.linkInput, { color: colors.foreground, borderColor: colors.border }]}
                      autoCapitalize="none"
                      keyboardType="url"
                      textAlign="right"
                    />
                    <Pressable onPress={saveLink} style={[styles.linkButton, { backgroundColor: colors.primary }]}>
                      <Text style={styles.linkButtonText}>حفظ رابط</Text>
                    </Pressable>
                  </View>
                </View>
                {analyzingId === "gallery" && (
                  <View style={[styles.analysisPreview, { borderColor: colors.primary }]}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[styles.previewHint, { color: colors.muted }]}>كنفهمو الصورة بالذكاء الاصطناعي...</Text>
                  </View>
                )}
                {pendingAnalysis && (
                  <View style={[styles.analysisPreview, { borderColor: colors.primary, backgroundColor: `${colors.primary}0d` }]}>
                    <Text style={[styles.previewEyebrow, { color: colors.primary }]}>Preview قبل الحفظ</Text>
                    <Text style={[styles.previewTitle, { color: colors.foreground }]}>{pendingAnalysis.analysis.title || pendingAnalysis.filename}</Text>
                    <Text style={[styles.previewSummary, { color: colors.foreground }]}>{pendingAnalysis.analysis.summary || "ما خرج حتى summary واضح."}</Text>
                    <Text style={[styles.previewMeta, { color: colors.muted }]}>OCR: {pendingAnalysis.analysis.ocrText.slice(0, 180) || "ما كاينش نص واضح"}</Text>
                    <Text style={[styles.previewMeta, { color: colors.primary }]}>#{pendingAnalysis.analysis.tags.join(" #") || "بدون tags"}</Text>
                    <View style={styles.previewActions}>
                      <Pressable onPress={() => setPendingAnalysis(null)} style={[styles.previewCancel, { borderColor: colors.border }]}>
                        <Text style={[styles.previewCancelText, { color: colors.muted }]}>إلغاء</Text>
                      </Pressable>
                      <Pressable onPress={savePendingImage} style={[styles.previewSave, { backgroundColor: colors.primary }]}>
                        <Text style={styles.previewSaveText}>حفظ وتحضير التذكير</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
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

              {Platform.OS !== "web" && shots.length > 0 && (
                <View style={styles.shotsSection}>
                  <View style={styles.listHeading}>
                    <Text style={[styles.listTitle, { color: colors.foreground }]}>آخر اللقطات ديالك</Text>
                    <Pressable onPress={refreshScreenshots} hitSlop={8}>
                      <Text style={[styles.listHint, { color: colors.primary }]}>
                        {shotsLoading ? "..." : "حدّث"}
                      </Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.shotsRow}
                  >
                    {shots.map((shot) => (
                      <View key={shot.id} style={[styles.shotCard, { borderColor: colors.border }]}>
                        <Image source={{ uri: shot.uri }} style={styles.shotThumb} contentFit="cover" />
                        <View style={styles.shotActions}>
                          <Pressable
                            onPress={() => saveScreenshot(shot)}
                            style={[styles.shotButton, { backgroundColor: colors.primary }]}
                          >
                            <Text style={styles.shotButtonText}>حفظ</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => analyzeScreenshot(shot)}
                            disabled={analyzingId !== null}
                            style={[styles.shotButton, { borderColor: colors.primary, borderWidth: 1 }]}
                          >
                            {analyzingId === shot.id ? (
                              <ActivityIndicator color={colors.primary} size="small" />
                            ) : (
                              <Text style={[styles.shotButtonText, { color: colors.primary }]}>حلّلها ✦</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

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
                {editingId === item.id ? (
                  <View style={styles.editPanel}>
                    <TextInput
                      value={editTags}
                      onChangeText={setEditTags}
                      placeholder="tags مفصولين بفاصلة"
                      placeholderTextColor={colors.muted}
                      style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
                      textAlign="right"
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editThemeRow}>
                      {CONTENT_THEMES.map((value) => (
                        <Pressable key={value} onPress={() => setEditTheme(value)} style={[styles.editTheme, { borderColor: editTheme === value ? colors.primary : colors.border }]}>
                          <Text style={[styles.editThemeText, { color: editTheme === value ? colors.primary : colors.muted }]}>{themeLabel[value]}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Pressable onPress={saveMetadata} style={[styles.editSave, { backgroundColor: colors.primary }]}>
                      <Text style={styles.editSaveText}>حفظ التعديلات</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => beginEditMetadata(item)} style={styles.editTrigger}>
                    <Text style={[styles.editTriggerText, { color: colors.primary }]}>عدّل tags والتصنيف</Text>
                  </Pressable>
                )}
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
  moodCard: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 14 },
  moodHeading: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  moodTitle: { fontSize: 14, fontWeight: "800", textAlign: "right" },
  moodHint: { fontSize: 10, textAlign: "right", marginTop: 4 },
  moodEmoji: { fontSize: 25 },
  moodButton: { minHeight: 36, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 10 },
  moodButtonText: { fontSize: 11, fontWeight: "800" },
  moodOptions: { flexDirection: "row-reverse", gap: 6, marginTop: 9 },
  moodOption: { flex: 1, borderWidth: 1, borderRadius: 10, minHeight: 48, alignItems: "center", justifyContent: "center" },
  moodOptionEmoji: { fontSize: 17 },
  moodOptionText: { fontSize: 9, fontWeight: "700", marginTop: 2 },
  privacyRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  privacyText: { flex: 1, fontSize: 9, textAlign: "right", marginLeft: 6 },
  chatToggle: { borderRadius: 15, minHeight: 44, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  chatToggleText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  chatToggleIcon: { color: "#fff", fontSize: 17 },
  chatCard: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 16 },
  chatTitle: { fontSize: 15, fontWeight: "800", textAlign: "right" },
  chatHint: { fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 5, marginBottom: 10 },
  chatComposer: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 8 },
  chatInput: { flex: 1, minHeight: 48, maxHeight: 100, borderWidth: 1, borderRadius: 13, padding: 10, fontSize: 12, textAlignVertical: "top" },
  chatSend: { minHeight: 44, minWidth: 58, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  chatSendText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  answerBox: { borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 10 },
  answerText: { fontSize: 13, lineHeight: 20, textAlign: "right" },
  answerDate: { fontSize: 11, fontWeight: "700", textAlign: "right", marginTop: 7 },
  reminderButton: { minHeight: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 10 },
  reminderButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  captureCard: { borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 24 },
  cardHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" },
  cardEmoji: { color: "#F59E0B", fontSize: 20 },
  noteInput: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 72, fontSize: 13, textAlignVertical: "top", marginBottom: 14 },
  captureActions: { gap: 9, marginBottom: 13 },
  analysisPreview: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 13, gap: 7 },
  previewEyebrow: { fontSize: 10, fontWeight: "900", textAlign: "right" },
  previewTitle: { fontSize: 15, fontWeight: "800", textAlign: "right" },
  previewSummary: { fontSize: 13, lineHeight: 20, textAlign: "right" },
  previewMeta: { fontSize: 10, lineHeight: 16, textAlign: "right" },
  previewHint: { fontSize: 11, textAlign: "center" },
  previewActions: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  previewCancel: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  previewCancelText: { fontSize: 12, fontWeight: "700" },
  previewSave: { flex: 2, minHeight: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  previewSaveText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  secondaryButton: { borderWidth: 1, borderRadius: 12, minHeight: 38, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 12, fontWeight: "800" },
  linkComposer: { flexDirection: "row-reverse", gap: 7 },
  linkInput: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, fontSize: 12 },
  linkButton: { minWidth: 76, minHeight: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  linkButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  sectionLabelRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 7 },
  sectionLabel: { fontSize: 11, fontWeight: "700" },
  optionRow: { marginBottom: 10 },
  option: { borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, marginLeft: 7 },
  optionText: { fontSize: 11, fontWeight: "600" },
  primaryButton: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  shotsSection: { marginBottom: 24 },
  shotsRow: { flexDirection: "row-reverse", gap: 10, paddingBottom: 4 },
  shotCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden", width: 104 },
  shotThumb: { width: 104, height: 150 },
  shotActions: { padding: 6, gap: 5 },
  shotButton: { minHeight: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  shotButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
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
  editTrigger: { marginTop: 7, alignSelf: "flex-end" },
  editTriggerText: { fontSize: 10, fontWeight: "800" },
  editPanel: { width: "100%", gap: 7, marginTop: 8 },
  editInput: { borderWidth: 1, borderRadius: 10, minHeight: 34, paddingHorizontal: 9, fontSize: 11 },
  editThemeRow: { gap: 6, paddingVertical: 2 },
  editTheme: { borderWidth: 1, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 7 },
  editThemeText: { fontSize: 9, fontWeight: "700" },
  editSave: { minHeight: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  editSaveText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  empty: { paddingVertical: 24 },
  emptyText: { textAlign: "center", paddingVertical: 24, fontSize: 13 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
