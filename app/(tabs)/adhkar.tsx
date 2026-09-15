import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ADHKAR, TASBIH_PHRASES, type DhikrEntry } from "@/shared/adhkar";
import { formatHijri, hijriDate } from "@/shared/hijri";
import { formatClock, formatMoroccanDate, formatMoroccoClock } from "@/shared/dates";
import {
  getCompletedAdhkarIds,
  getTasbihCount,
  incrementTasbih,
  resetTasbih,
  toggleAdhkarDone,
} from "@/lib/adhkar-progress";

const PERIOD_TITLES: Record<DhikrEntry["period"], string> = {
  morning: "أذكار الصباح",
  evening: "أذكار المساء",
};

export default function AdhkarScreen() {
  const colors = useColors();
  const [now, setNow] = useState(() => new Date());
  const [doneIds, setDoneIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTasbih, setSelectedTasbih] = useState(TASBIH_PHRASES[0]?.key ?? "");
  const [tasbihCount, setTasbihCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([getCompletedAdhkarIds(), getTasbihCount(selectedTasbih)])
      .then(([ids, count]) => {
        if (!mounted) return;
        setDoneIds(ids);
        setTasbihCount(count);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [selectedTasbih]);

  const selectedPhrase = useMemo(
    () => TASBIH_PHRASES.find((phrase) => phrase.key === selectedTasbih) ?? TASBIH_PHRASES[0],
    [selectedTasbih],
  );
  const ringProgress = selectedPhrase ? tasbihCount % selectedPhrase.target : 0;
  const ringPercent = selectedPhrase ? ringProgress / selectedPhrase.target : 0;

  const handleTasbihTap = async () => {
    if (!selectedPhrase || busy) return;
    setBusy(true);
    try {
      const next = await incrementTasbih(selectedPhrase.key);
      setTasbihCount(next);
      if (next % selectedPhrase.target === 0) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTasbihReset = async () => {
    if (!selectedPhrase) return;
    await resetTasbih(selectedPhrase.key);
    setTasbihCount(0);
  };

  const handleToggleDhikr = async (id: number) => {
    const done = await toggleAdhkarDone(id);
    setDoneIds((prev) => (done ? [...prev, id] : prev.filter((doneId) => doneId !== id)));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const hijri = useMemo(() => hijriDate(now), [now]);
  const completedMorning = ADHKAR.filter((e) => e.period === "morning" && doneIds.includes(e.id)).length;
  const completedEvening = ADHKAR.filter((e) => e.period === "evening" && doneIds.includes(e.id)).length;

  const renderHeader = () => (
    <View>
      {/* ─── Live clock ─────────────────────────────────── */}
      <View style={[styles.clockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>ذِكْرى — الساعة</Text>
        <Text style={[styles.clockTime, { color: colors.foreground }]}>{formatClock(now)}</Text>
        <Text style={[styles.clockDate, { color: colors.muted }]}>{formatMoroccanDate(now)}</Text>
        <Text style={[styles.clockHijri, { color: colors.primary }]}>{formatHijri(hijri)}</Text>
        <View style={[styles.timezoneRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.timezoneText, { color: colors.muted }]}>وقتك: {formatClock(now)}</Text>
          <Text style={[styles.timezoneText, { color: colors.muted }]}>الرباط: {formatMoroccoClock(now)}</Text>
        </View>
      </View>

      {/* ─── Tasbih counter ─────────────────────────────── */}
      <View style={[styles.tasbihCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>المسبحة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phraseRow}>
          {TASBIH_PHRASES.map((phrase) => (
            <Pressable
              key={phrase.key}
              onPress={() => setSelectedTasbih(phrase.key)}
              style={[
                styles.phrasePill,
                { borderColor: selectedTasbih === phrase.key ? colors.primary : colors.border },
                selectedTasbih === phrase.key && { backgroundColor: `${colors.primary}22` },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.phraseText, { color: selectedTasbih === phrase.key ? colors.primary : colors.muted }]}
              >
                {phrase.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.counterArea}>
          <Pressable
            onPress={handleTasbihTap}
            style={[styles.counterCircle, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.counterNumber}>{ringProgress}</Text>
            <Text style={styles.counterTarget}>/ {selectedPhrase?.target ?? 33}</Text>
          </Pressable>
          <View style={styles.counterMeta}>
            <Text style={[styles.counterLabel, { color: colors.foreground }]}>{selectedPhrase?.label}</Text>
            <Text style={[styles.counterTotal, { color: colors.muted }]}>اليوم: {tasbihCount} مرة</Text>
            <Pressable onPress={handleTasbihReset} style={[styles.resetButton, { borderColor: colors.border }]}>
              <Text style={[styles.resetText, { color: colors.muted }]}>صفّر العداد</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(ringPercent * 100)}%` }]}
          />
        </View>
        <Text style={[styles.progressHint, { color: colors.muted }]}>
          كبس على الدايرة باش تزيد وحدة — عند كل {selectedPhrase?.target ?? 33} كيتهز التطبيق.
        </Text>
      </View>

      {/* ─── Adhkar sections ────────────────────────────── */}
      <View style={styles.sectionHeading}>
        <Text style={[styles.listTitle, { color: colors.foreground }]}>أذكار اليوم</Text>
        <Text style={[styles.listHint, { color: colors.muted }]}>
          الصباح {completedMorning}/{ADHKAR.filter((e) => e.period === "morning").length} · المساء{" "}
          {completedEvening}/{ADHKAR.filter((e) => e.period === "evening").length}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={ADHKAR}
          keyExtractor={(entry) => String(entry.id)}
          contentContainerStyle={styles.content}
          ListHeaderComponent={renderHeader()}
          renderItem={({ item, index }) => {
            const isSectionStart = index === 0 || ADHKAR[index - 1].period !== item.period;
            const done = doneIds.includes(item.id);
            return (
              <View>
                {isSectionStart && (
                  <Text style={[styles.sectionLabel, { color: colors.primary }]}>{PERIOD_TITLES[item.period]}</Text>
                )}
                <View
                  style={[
                    styles.dhikrCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    done && styles.doneCard,
                  ]}
                >
                  <View style={styles.dhikrHeader}>
                    <Text style={[styles.dhikrText, { color: colors.foreground }]}>{item.text}</Text>
                    <View style={[styles.countBadge, { backgroundColor: `${colors.primary}1c` }]}>
                      <Text style={[styles.countBadgeText, { color: colors.primary }]}>×{item.count}</Text>
                    </View>
                  </View>
                  {item.fadl ? <Text style={[styles.fadlText, { color: colors.muted }]}>✦ {item.fadl}</Text> : null}
                  <Pressable
                    onPress={() => handleToggleDhikr(item.id)}
                    style={[
                      styles.doneButton,
                      done ? { backgroundColor: colors.success } : { borderColor: colors.primary, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.doneButtonText, { color: done ? "#fff" : colors.primary }]}>
                      {done ? "✓ تمّت اليوم" : "علّم تمّت"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  // clock
  clockCard: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 14, alignItems: "center" },
  eyebrow: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  clockTime: { fontSize: 44, fontWeight: "900", letterSpacing: 2 },
  clockDate: { fontSize: 14, marginTop: 4 },
  clockHijri: { fontSize: 14, fontWeight: "800", marginTop: 3 },
  timezoneRow: { flexDirection: "row-reverse", justifyContent: "space-between", width: "100%", borderTopWidth: 0.5, marginTop: 14, paddingTop: 10 },
  timezoneText: { fontSize: 11, fontWeight: "600" },
  // tasbih
  tasbihCard: { borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 18 },
  cardTitle: { fontSize: 16, fontWeight: "800", textAlign: "right", marginBottom: 10 },
  phraseRow: { flexDirection: "row-reverse", gap: 7, paddingBottom: 4 },
  phrasePill: { borderWidth: 1, borderRadius: 13, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 170 },
  phraseText: { fontSize: 12, fontWeight: "700" },
  counterArea: { flexDirection: "row-reverse", alignItems: "center", gap: 16, marginTop: 14 },
  counterCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
  },
  counterNumber: { color: "#fff", fontSize: 44, fontWeight: "900" },
  counterTarget: { color: "#fff", fontSize: 14, fontWeight: "700", opacity: 0.85, marginTop: 14, marginRight: 4 },
  counterMeta: { flex: 1, alignItems: "flex-end" },
  counterLabel: { fontSize: 15, fontWeight: "800", textAlign: "right" },
  counterTotal: { fontSize: 12, textAlign: "right", marginTop: 6 },
  resetButton: { borderWidth: 1, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, marginTop: 12 },
  resetText: { fontSize: 11, fontWeight: "700" },
  progressTrack: { height: 7, borderRadius: 4, marginTop: 14, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 4 },
  progressHint: { fontSize: 10, textAlign: "center", marginTop: 8, lineHeight: 15 },
  // sections
  sectionHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  listTitle: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  listHint: { fontSize: 10 },
  sectionLabel: { fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: 10, marginBottom: 10 },
  dhikrCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  doneCard: { opacity: 0.62 },
  dhikrHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  dhikrText: { flex: 1, fontSize: 16, lineHeight: 28, textAlign: "right", fontWeight: "600" },
  countBadge: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 },
  countBadgeText: { fontSize: 11, fontWeight: "800" },
  fadlText: { fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 8 },
  doneButton: { minHeight: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 10 },
  doneButtonText: { fontSize: 12, fontWeight: "800" },
});
