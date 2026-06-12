import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Router, X } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import { AccentSerif, Body, Heading, Mono, SmallCaps, Surface } from "../components/ui";
import { api, apiErrorMessage } from "../api/client";
import { toast } from "../components/toast";
import { colors, radius } from "../theme";

function StatLine({ label, value, accent, success }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.brand }, success && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

export function GatewayDiagScreen({ navigation }) {
  const [gateways, setGateways] = useState([]);
  const [selected, setSelected] = useState(null);
  const [diag, setDiag] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/gateways").then((r) => setGateways(r.data)).catch(() => {});
  }, []);

  const run = async (gw) => {
    setSelected(gw);
    setDiag(null);
    setBusy(true);
    try {
      const { data } = await api.post(`/gateways/${gw.id}/test`);
      setDiag(data);
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Gateway diagnostics" back navigation={navigation} gap={20}>
      <View>
        <SmallCaps>Diagnostics</SmallCaps>
        <Heading size={22} style={{ marginTop: 4 }}>
          Test any <AccentSerif>gateway.</AccentSerif>
        </Heading>
        <Body style={{ marginTop: 8 }}>Pings the device, refreshes its status, returns a health snapshot.</Body>
      </View>

      <View style={{ gap: 8 }}>
        <SmallCaps style={{ marginBottom: 4 }}>Pick a gateway</SmallCaps>
        {gateways.map((gw) => {
          const on = selected?.id === gw.id;
          return (
            <Pressable
              key={gw.id}
              onPress={() => run(gw)}
              style={[styles.gwRow, { borderColor: on ? colors.cream : colors.border }]}
              testID={`diag-gateway-${gw.gateway_id}`}
            >
              <View style={styles.gwIcon}>
                <Router size={16} color={colors.text} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gwId}>{gw.gateway_id}</Text>
                <Mono color={colors.faint} style={{ fontSize: 11, marginTop: 2 }}>{gw.mac_address}</Mono>
              </View>
              <StatusBadge status={gw.status} />
            </Pressable>
          );
        })}
        {gateways.length === 0 && <Body>No gateways registered yet.</Body>}
      </View>

      {selected && (
        <Modal
          visible={!!selected}
          transparent
          animationType="fade"
          onRequestClose={() => setSelected(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <SmallCaps>Diagnostics result</SmallCaps>
                  <Heading size={18} style={{ marginTop: 4 }}>{selected.gateway_id}</Heading>
                </View>
                <Pressable onPress={() => setSelected(null)} style={styles.closeBtn} hitSlop={8}>
                  <X size={20} color={colors.text} strokeWidth={2} />
                </Pressable>
              </View>

              {busy ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 32 }}>
                  <ActivityIndicator color={colors.brand} />
                  <SmallCaps>Running…</SmallCaps>
                </View>
              ) : diag ? (
                <View style={{ gap: 12 }}>
                  <SmallCaps color={colors.brand}>
                    {new Date(diag.server_time).toLocaleTimeString()}
                  </SmallCaps>
                  <View style={styles.hair} />
                  <StatLine label="Status" value="● Online" success />
                  <StatLine label="MAC" value={diag.mac_address} />
                  <StatLine label="IP" value={diag.ip_address || "—"} />
                  <StatLine label="Firmware" value={diag.firmware_version} />
                  <StatLine label="RSSI" value={`${diag.rssi || "?"} dBm`} />
                  <StatLine label="Tags detected" value={diag.tags_detected} />
                  <StatLine label="Low battery tags" value={diag.low_battery_tags} />
                  <StatLine label="Scan interval" value={`${diag.config.scan_interval_sec}s`} />
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gwRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1, backgroundColor: colors.surface },
  gwIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
  gwId: { color: colors.text, fontWeight: "600", letterSpacing: -0.3 },
  hair: { height: 1, backgroundColor: colors.hairlineSoft, marginVertical: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  statLabel: { color: colors.muted, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 10.5, fontWeight: "600" },
  statValue: { color: colors.text, fontWeight: "600", letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: colors.bg, borderRadius: radius.lg, width: "100%", maxWidth: 400, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  closeBtn: { padding: 4 },
});
