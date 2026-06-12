import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { ArrowRight, ArrowLeft, Check, Hash, Tag, Plus, Sparkles } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { Stepper } from "../components/Stepper";
import {
  Body, Heading, Input, Mono, PrimaryButton, SecondaryButton, SmallCaps, Surface, Ticking,
} from "../components/ui";
import { api, apiErrorMessage, getServerUrl } from "../api/client";
import { useQuota } from "../context/useQuota";
import { toast } from "../components/toast";
import { colors, radius } from "../theme";
import tickAnimation from "../../assets/green-tick.json";

const EMPTY = {
  tag_id: "",
  ble_mac: "",
  battery: 100,
  firmware_version: "v2.1.0",
  manufacturing_batch: "BATCH-2026-01",
  notes: "",
};

export function AddTagScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const quota = useQuota("tags");
  const [macFocused, setMacFocused] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/tags", form);
      setCreated(data);
      toast.success("Tag added", { description: form.tag_id });
      setStep(2);
      quota.refresh();
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setForm(EMPTY);
    setCreated(null);
  };

  return (
    <Screen
      title="Add new tag"
      back
      navigation={navigation}
      gap={20}
      scrollable={step !== 2}
      contentStyle={step === 2 ? { flex: 1, paddingBottom: 16 } : undefined}
    >
      <Stepper steps={["Identify", "Details", "Done"]} current={step} />

      {step === 0 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : "position"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 120}
          style={{ width: "100%" }}
          contentContainerStyle={{ gap: 20 }}
          enabled={macFocused}
        >
          <View style={{ gap: 20 }}>
            <View>
              <SmallCaps>Step 1</SmallCaps>
              <Heading size={22} style={{ marginTop: 4 }}>Identify the tag</Heading>
              <Body style={{ marginTop: 8 }}>Scan the QR or type the printed Tag ID. The BLE MAC is on the back.</Body>
            </View>

            {quota.limit > 0 && (
              <View style={[styles.quota, quota.blocked ? styles.quotaBlocked : quota.near_limit ? styles.quotaWarn : styles.quotaOk]} testID="mobile-tag-quota">
                <SmallCaps color={quota.blocked ? colors.brandText : colors.muted}>Tag quota</SmallCaps>
                <Mono color={quota.blocked ? colors.brandText : colors.muted}>{quota.current} / {quota.limit}</Mono>
              </View>
            )}

            <Surface>
              <SmallCaps>Tag ID</SmallCaps>
              <View style={styles.iconField}>
                <Hash size={14} color={colors.faint} />
                <Input
                  value={form.tag_id}
                  onChangeText={(t) => set("tag_id", t.toUpperCase())}
                  placeholder="ST-000021"
                  autoCapitalize="characters"
                  monospace
                  style={styles.fieldInput}
                  testID="add-tag-id-input"
                />
              </View>
            </Surface>

            <Surface>
              <SmallCaps>BLE MAC</SmallCaps>
              <View style={styles.iconField}>
                <Tag size={14} color={colors.faint} />
                <Input
                  value={form.ble_mac}
                  onChangeText={(t) => set("ble_mac", t.toUpperCase())}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  autoCapitalize="characters"
                  monospace
                  style={styles.fieldInput}
                  testID="add-tag-mac-input"
                  onFocus={() => setMacFocused(true)}
                  onBlur={() => setMacFocused(false)}
                />
              </View>
            </Surface>

            <PrimaryButton
              title={quota.blocked ? "Limit reached" : "Next"}
              icon={!quota.blocked ? <ArrowRight size={15} color={colors.ink} strokeWidth={2} /> : undefined}
              onPress={() => setStep(1)}
              disabled={!form.tag_id || !form.ble_mac || quota.blocked}
              testID="add-tag-step-1-next"
            />
            {quota.blocked && (
              <View style={styles.upgradeLink}>
                <Pressable onPress={() => Linking.openURL(`${getServerUrl()}/license`)}>
                  <Text style={styles.upgradeLinkText}>Upgrade plan</Text>
                </Pressable>
                <View style={styles.underline} />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {step === 1 && (
        <>
          <View>
            <SmallCaps>Step 2</SmallCaps>
            <Heading size={22} style={{ marginTop: 4 }}>Details & notes</Heading>
            <Body style={{ marginTop: 8 }}>Battery, firmware, batch — usually pre-filled from manufacturer.</Body>
          </View>

          <Surface>
            <SmallCaps>Battery percentage</SmallCaps>
            <View style={styles.battRow}>
              {[20, 40, 60, 80, 100].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => set("battery", v)}
                  style={[styles.battChip, form.battery === v && styles.battChipOn]}
                >
                  <Text style={[styles.battChipText, form.battery === v && { color: colors.ink }]}>{v}%</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
              <Ticking size={24}>{form.battery}%</Ticking>
              <SmallCaps color={colors.faint}>
                {form.battery > 60 ? "Healthy" : form.battery > 20 ? "Medium" : "Low"}
              </SmallCaps>
            </View>
          </Surface>

          <Surface>
            <SmallCaps>Firmware version</SmallCaps>
            <Input value={form.firmware_version} onChangeText={(t) => set("firmware_version", t)} monospace style={{ marginTop: 8 }} />
          </Surface>

          <Surface>
            <SmallCaps>Manufacturing batch</SmallCaps>
            <Input value={form.manufacturing_batch} onChangeText={(t) => set("manufacturing_batch", t)} monospace style={{ marginTop: 8 }} />
          </Surface>

          <Surface>
            <SmallCaps>Notes (optional)</SmallCaps>
            <Input
              value={form.notes}
              onChangeText={(t) => set("notes", t)}
              placeholder="Anything to remember about this tag…"
              multiline
              style={{ marginTop: 8, minHeight: 56, textAlignVertical: "top" }}
            />
          </Surface>

          <View style={styles.row2}>
            <SecondaryButton
              title="Back"
              icon={<ArrowLeft size={14} color={colors.text} strokeWidth={2} />}
              onPress={() => setStep(0)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Save tag"
              icon={<Check size={14} color={colors.ink} strokeWidth={2} />}
              onPress={save}
              disabled={busy}
              loading={busy}
              style={{ flex: 1 }}
              testID="add-tag-save"
            />
          </View>
        </>
      )}

      {step === 2 && created && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 }}>
          <LottieView
            source={tickAnimation}
            autoPlay
            loop={false}
            style={{ width: 100, height: 100 }}
          />
          <Text style={[styles.doneTitle, { marginTop: 5 }]}>Tag added</Text>
          <Mono color={colors.textDim} style={{ marginTop: 4 }}>{created.tag_id}</Mono>
          <Body style={{ textAlign: "center", marginTop: 8, maxWidth: 280 }}>
            Tap "Assign now" to attach it to a room and product. Otherwise it stays in inventory.
          </Body>
          <View style={{ marginTop: 28, alignSelf: "stretch", paddingHorizontal: 16, gap: 8 }}>
            <PrimaryButton
              title="Assign now"
              icon={<Sparkles size={14} color={colors.ink} strokeWidth={2} />}
              onPress={() => navigation.navigate("Scan")}
              testID="add-tag-assign-now"
            />
            <SecondaryButton title="Add another" icon={<Plus size={14} color={colors.text} strokeWidth={2} />} onPress={reset} />
            <SecondaryButton title="Home" onPress={() => navigation.navigate("Home")} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quota: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1 },
  quotaOk: { borderColor: colors.border, backgroundColor: "#0F0F0F" },
  quotaWarn: { borderColor: "rgba(255,182,97,0.4)", backgroundColor: "rgba(255,182,97,0.06)" },
  quotaBlocked: { borderColor: "rgba(255,126,107,0.4)", backgroundColor: "rgba(255,126,107,0.08)" },
  iconField: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  fieldInput: { flex: 1, fontSize: 17 },
  battRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  battChip: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.chip, alignItems: "center" },
  battChipOn: { backgroundColor: colors.cream },
  battChipText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  row2: { flexDirection: "row", gap: 12 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(31,122,61,0.15)", alignItems: "center", justifyContent: "center" },
  doneTitle: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 24, letterSpacing: -0.6 },
  upgradeLink: { alignItems: "center", marginTop: 20 },
  upgradeLinkText: { color: colors.brand, fontSize: 14, fontWeight: "600" },
  underline: { height: 1, backgroundColor: colors.brand, marginTop: 4, width: 80, alignSelf: "center" },
});
