import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { ArrowRight, Check, FileWarning, ShieldOff, Wrench } from "lucide-react-native";
import { Screen } from "../components/Screen";
import {
  AccentSerif, Body, Heading, Input, Mono, PrimaryButton, SecondaryButton, SmallCaps, Surface,
} from "../components/ui";
import { api, apiErrorMessage } from "../api/client";
import { toast } from "../components/toast";
import { colors, radius } from "../theme";
import greenTickAnimation from "../../assets/green-tick.json";

const TYPES = [
  { id: "damaged", label: "Damaged tag", hint: "Visible damage, not reading", icon: FileWarning },
  { id: "missing", label: "Missing", hint: "Tag not in room", icon: ShieldOff },
  { id: "issue", label: "Other issue", hint: "Sticker, sensor, anything", icon: Wrench },
];

export function ReportScreen({ navigation, route }) {
  const params = route?.params || {};
  const [type, setType] = useState(params.type || "damaged");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    if (params.tagId) {
      api
        .get("/tags")
        .then(({ data }) => {
          const found = data.find((x) => x.id === params.tagId);
          if (found) setTag(found);
        })
        .catch(() => {});
    }
  }, [params.tagId]);

  const lookup = async () => {
    if (!search) return;
    try {
      const { data } = await api.get(`/tags/by-tag-id/${encodeURIComponent(search)}`);
      setTag(data);
    } catch (_e) {
      toast.error("Tag not found");
    }
  };

  const submit = async () => {
    if (!tag) return toast.error("Pick a tag");
    if (!reason) return toast.error("Pick a reason");
    setBusy(true);
    try {
      if (type === "missing") {
        await api.post(`/tags/${tag.id}/report-missing`, { reason });
        toast.success("Tag marked missing");
      } else if (type === "damaged") {
        await api.post(`/tags/${tag.id}/report-damaged`, { reason });
        toast.success("Tag marked damaged");
      } else {
        await api.post(`/tags/${tag.id}/report-damaged`, { reason: `Issue: ${reason}` });
        toast.success("Issue logged");
      }
      setDone(true);
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const REASONS =
    type === "damaged"
      ? ["Visibly cracked", "Won't power on", "Sensor not responding", "Sticker damaged"]
      : type === "missing"
      ? ["Not in room", "Possibly stolen", "Lost during cleaning", "Bottle replaced without tag"]
      : ["Sticker worn", "Tag loose on cap", "Other"];

  if (done) {
    return (
      <Screen
        title="Reported"
        back
        navigation={navigation}
        scrollable={false}
        contentStyle={{ flex: 1, paddingBottom: 16, justifyContent: "center" }}
      >
        <Surface padding={32} style={{ alignItems: "center" }}>
          <LottieView
            source={greenTickAnimation}
            autoPlay
            loop={false}
            style={{ width: 100, height: 100 }}
          />
          <Text style={[styles.doneTitle, { marginTop: 5 }]}>Logged</Text>
          <Body style={{ textAlign: "center", marginTop: 8, maxWidth: 280 }}>
            Reception has been notified. Tag has been flagged in the system.
          </Body>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 24, alignSelf: "stretch" }}>
            <SecondaryButton title="Home" onPress={() => navigation.navigate("Home")} style={{ flex: 1 }} />
            <PrimaryButton
              title="New report"
              onPress={() => { setDone(false); setTag(null); setReason(""); setSearch(""); }}
              style={{ flex: 1 }}
            />
          </View>
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen title="Report" back navigation={navigation} gap={24}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : "position"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -80 : -40}
        style={{ width: "100%" }}
        contentContainerStyle={{ gap: 24 }}
        enabled={searchFocused}
      >
        <View style={{ gap: 24 }}>
          <View>
            <SmallCaps>Report</SmallCaps>
            <Heading size={22} style={{ marginTop: 4 }}>
              What happened on <AccentSerif>the floor?</AccentSerif>
            </Heading>
          </View>

          <View style={{ gap: 8 }}>
            <SmallCaps style={{ marginBottom: 4 }}>Issue type</SmallCaps>
            {TYPES.map((t) => {
              const on = type === t.id;
              const Icon = t.icon;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setType(t.id)}
                  style={[styles.typeRow, on ? styles.cellOnBorder : styles.cellOff]}
                  testID={`report-type-${t.id}`}
                >
                  <View style={[styles.typeIcon, { backgroundColor: on ? colors.cream : colors.chip }]}>
                    <Icon size={16} color={on ? colors.ink : colors.textDim} strokeWidth={1.7} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.typeLabel}>{t.label}</Text>
                    <Body style={{ fontSize: 12, marginTop: 2 }}>{t.hint}</Body>
                  </View>
                  {on ? <Check size={22} color={colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>

          {!tag ? (
            <Surface>
              <SmallCaps style={{ marginBottom: 8 }}>Which tag?</SmallCaps>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Input
                  value={search}
                  onChangeText={(t) => setSearch(t.toUpperCase())}
                  placeholder="ST-000001"
                  autoCapitalize="characters"
                  monospace
                  style={{ flex: 1 }}
                  testID="report-tag-search"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                <SecondaryButton title="Find" onPress={lookup} style={{ paddingHorizontal: 18 }} />
              </View>
            </Surface>
          ) : (
            <Surface>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Mono style={{ fontWeight: "700", color: colors.text }}>{tag.tag_id}</Mono>
                  <SmallCaps color={colors.faint} style={{ marginTop: 4 }}>
                    {tag.product_name || "—"} · Room {tag.assigned_room_number || tag.room_number || "?"}
                  </SmallCaps>
                </View>
                <Pressable onPress={() => setTag(null)} hitSlop={8}>
                  <Text style={styles.change}>Change</Text>
                </Pressable>
              </View>
            </Surface>
          )}

          <View>
            <SmallCaps style={{ marginBottom: 12 }}>Reason</SmallCaps>
            <View style={styles.reasonGrid}>
              {REASONS.map((r) => {
                const on = reason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={[styles.reasonChip, on ? styles.cellOn : styles.cellOff]}
                    testID={`report-reason-${r.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Text style={[styles.reasonText, { color: on ? colors.ink : colors.text }]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Input
              value={reason}
              onChangeText={setReason}
              placeholder="Or describe in your own words…"
              style={{ marginTop: 12 }}
            />
          </View>

          <PrimaryButton
            title="Submit report"
            icon={<ArrowRight size={15} color={colors.ink} strokeWidth={2} />}
            onPress={submit}
            disabled={busy || !tag || !reason}
            loading={busy}
            testID="submit-report"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1 },
  cellOnBorder: { backgroundColor: "rgba(255,126,107,0.08)", borderColor: "rgba(255,126,107,0.4)" },
  cellOff: { backgroundColor: colors.surface, borderColor: colors.border },
  cellOn: { backgroundColor: colors.cream, borderColor: colors.cream },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  typeLabel: { color: colors.text, fontWeight: "600", fontSize: 14, letterSpacing: -0.3 },
  change: { color: colors.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 10.5, fontWeight: "600" },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: { width: "48%", padding: 12, borderRadius: radius.sm, borderWidth: 1 },
  reasonText: { fontSize: 14, fontWeight: "500" },
  okCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(31,122,61,0.15)", alignItems: "center", justifyContent: "center" },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 16, letterSpacing: -0.5 },
});
