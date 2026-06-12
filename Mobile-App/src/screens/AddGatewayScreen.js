import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { ArrowRight, ArrowLeft, Check, Plus, Stethoscope, Copy } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { Screen } from "../components/Screen";
import { Stepper } from "../components/Stepper";
import {
  Body, Heading, Input, Mono, PrimaryButton, SecondaryButton, SmallCaps, Surface, Ticking,
} from "../components/ui";
import { api, apiErrorMessage, getServerUrl } from "../api/client";
import { useQuota } from "../context/useQuota";
import { toast } from "../components/toast";
import { colors, radius } from "../theme";
import greenTickAnimation from "../../assets/green-tick.json";

function StatLine({ label, value, accent }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.brand }]}>{value}</Text>
    </View>
  );
}

const EMPTY = { gateway_id: "", mac_address: "", ip_address: "", firmware_version: "v1.2.3", floor: "", room_id: "" };

export function AddGatewayScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [rooms, setRooms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [diag, setDiag] = useState(null);
  const quota = useQuota("gateways");
  const [macFocused, setMacFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get("/rooms").then((r) => setRooms(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/gateways", { ...form, room_id: form.room_id || null });
      setCreated(data);
      toast.success("Gateway added", { description: form.gateway_id });
      setStep(2);
      quota.refresh();
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const runDiag = async () => {
    if (!created) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/gateways/${created.id}/test`);
      setDiag(data);
      toast.success("Diagnostics OK");
    } catch (e) {
      toast.error("Diag failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const copyApiKey = async () => {
    if (!created) return;
    try {
      await Clipboard.setStringAsync(created.api_key);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy");
    }
  };

  return (
    <Screen
      title="Add gateway"
      back
      navigation={navigation}
      gap={20}
      scrollable={step !== 2}
      contentStyle={step === 2 ? { flex: 1, paddingBottom: 16 } : undefined}
    >
      <Stepper steps={["Identify", "Network", "Done"]} current={step} />

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
              <Heading size={22} style={{ marginTop: 4 }}>Identify the gateway</Heading>
              <Body style={{ marginTop: 8 }}>Read the Gateway ID printed on the device, plus its MAC.</Body>
            </View>

            {quota.limit > 0 && (
              <View style={[styles.quota, quota.blocked ? styles.quotaBlocked : quota.near_limit ? styles.quotaWarn : styles.quotaOk]} testID="mobile-gateway-quota">
                <SmallCaps color={quota.blocked ? colors.brandText : colors.muted}>Gateway quota</SmallCaps>
                <Mono color={quota.blocked ? colors.brandText : colors.muted}>{quota.current} / {quota.limit}</Mono>
              </View>
            )}

            <Surface>
              <SmallCaps>Gateway ID</SmallCaps>
              <Input value={form.gateway_id} onChangeText={(t) => set("gateway_id", t.toUpperCase())} placeholder="GW-301" autoCapitalize="characters" monospace style={{ marginTop: 8, fontSize: 17 }} testID="add-gateway-id-input" />
            </Surface>

            <Surface>
              <SmallCaps>MAC address</SmallCaps>
              <Input
                value={form.mac_address}
                onChangeText={(t) => set("mac_address", t.toUpperCase())}
                placeholder="AA:BB:CC:DD:EE:FF"
                autoCapitalize="characters"
                monospace
                style={{ marginTop: 8, fontSize: 17 }}
                onFocus={() => setMacFocused(true)}
                onBlur={() => setMacFocused(false)}
              />
            </Surface>

            <PrimaryButton
              title={quota.blocked ? "Limit reached" : "Next"}
              icon={!quota.blocked ? <ArrowRight size={15} color={colors.ink} strokeWidth={2} /> : undefined}
              onPress={() => setStep(1)}
              disabled={!form.gateway_id || !form.mac_address || quota.blocked}
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
            <Heading size={22} style={{ marginTop: 4 }}>Network & placement</Heading>
            <Body style={{ marginTop: 8 }}>Optional but recommended — helps diagnostics later.</Body>
          </View>

          <Surface>
            <SmallCaps>IP address (optional)</SmallCaps>
            <Input value={form.ip_address} onChangeText={(t) => set("ip_address", t)} placeholder="192.168.1.x" monospace style={{ marginTop: 8 }} />
          </Surface>

          <Surface>
            <SmallCaps>Firmware</SmallCaps>
            <Input value={form.firmware_version} onChangeText={(t) => set("firmware_version", t)} monospace style={{ marginTop: 8 }} />
          </Surface>

          <Surface>
            <SmallCaps>Assign to room (optional)</SmallCaps>
            <View style={styles.grid3}>
              {rooms.map((r) => {
                const on = form.room_id === r.id;
                return (
                  <Pressable key={r.id} onPress={() => set("room_id", on ? "" : r.id)} style={[styles.roomCell, on ? styles.cellOn : styles.cellOff]}>
                    <Ticking size={18} color={on ? colors.ink : colors.text}>{r.room_number}</Ticking>
                  </Pressable>
                );
              })}
            </View>
          </Surface>

          <View style={styles.row2}>
            <SecondaryButton title="Back" icon={<ArrowLeft size={14} color={colors.text} strokeWidth={2} />} onPress={() => setStep(0)} style={{ flex: 1 }} />
            <PrimaryButton
              title="Save & test"
              icon={<Check size={14} color={colors.ink} strokeWidth={2} />}
              onPress={save}
              disabled={busy}
              loading={busy}
              style={{ flex: 1 }}
              testID="add-gateway-save"
            />
          </View>
        </>
      )}

      {step === 2 && created && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 }}>
          <View style={{ alignItems: "center" }}>
            <LottieView
              source={greenTickAnimation}
              autoPlay
              loop={false}
              style={{ width: 100, height: 100 }}
            />
            <Text style={[styles.doneTitle, { marginTop: 5 }]}>Gateway saved</Text>
            <Mono color={colors.textDim} style={{ marginTop: 4 }}>{created.gateway_id}</Mono>
          </View>

          <Surface style={{ marginVertical: 20 }}>
            <SmallCaps style={{ marginBottom: 8 }}>API key</SmallCaps>
            <View style={styles.codeBox}>
              <Mono style={{ fontSize: 12, flex: 1 }}>{created.api_key}</Mono>
              <Pressable onPress={copyApiKey} style={styles.copyBtn}>
                {copied ? (
                  <Check size={13} color={colors.success} strokeWidth={2} />
                ) : (
                  <Copy size={13} color={colors.muted} strokeWidth={1.5} />
                )}
              </Pressable>
            </View>
            <Body style={{ fontSize: 11, marginTop: 8 }}>
              Paste into ESP32 firmware config. The gateway must POST events with this key.
            </Body>
          </Surface>

          <PrimaryButton
            title="Run diagnostics"
            icon={<Stethoscope size={14} color={colors.ink} strokeWidth={2} />}
            onPress={runDiag}
            loading={busy}
            style={{ width: "100%", marginBottom: 12 }}
            testID="run-gateway-diag"
          />

          {diag && (
            <Surface style={{ borderColor: "rgba(91,201,126,0.25)", width: "100%", marginBottom: 12 }}>
              <SmallCaps color={colors.success}>Diagnostics · {new Date(diag.server_time).toLocaleTimeString()}</SmallCaps>
              <View style={styles.hair} />
              <StatLine label="Status" value="● Online" accent />
              <StatLine label="RSSI" value={`${diag.rssi || "?"} dBm`} />
              <StatLine label="Tags detected" value={diag.tags_detected} />
              <StatLine label="Low battery" value={diag.low_battery_tags} />
              <StatLine label="Scan interval" value={`${diag.config.scan_interval_sec}s`} />
            </Surface>
          )}

          <View style={[styles.row2, { width: "100%" }]}>
            <SecondaryButton title="Home" onPress={() => navigation.navigate("Home")} style={{ flex: 1 }} />
            <PrimaryButton
              title="Add another"
              icon={<Plus size={14} color={colors.ink} strokeWidth={2} />}
              onPress={() => { setStep(0); setForm(EMPTY); setCreated(null); setDiag(null); }}
              style={{ flex: 1 }}
            />
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
  grid3: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  roomCell: { width: "31.5%", paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1, alignItems: "center" },
  cellOn: { backgroundColor: colors.cream, borderColor: colors.cream },
  cellOff: { backgroundColor: colors.surface, borderColor: colors.border },
  row2: { flexDirection: "row", gap: 12 },
  codeBox: { backgroundColor: colors.chip, padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  copyBtn: { padding: 4 },
  successCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(31,122,61,0.15)", alignItems: "center", justifyContent: "center" },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 16, letterSpacing: -0.5 },
  hair: { height: 1, backgroundColor: colors.hairlineSoft, marginVertical: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  statLabel: { color: colors.muted, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 10.5, fontWeight: "600" },
  statValue: { color: colors.text, fontWeight: "600", letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  upgradeLink: { alignItems: "center", marginTop: 20 },
  upgradeLinkText: { color: colors.brand, fontSize: 14, fontWeight: "600" },
  underline: { height: 1, backgroundColor: colors.brand, marginTop: 4, width: 80, alignSelf: "center" },
});
