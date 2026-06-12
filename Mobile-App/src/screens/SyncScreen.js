import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { AccentSerif, Body, Heading, PrimaryButton, SmallCaps, Surface, Ticking } from "../components/ui";
import { api, apiErrorMessage } from "../api/client";
import { toast } from "../components/toast";
import { colors } from "../theme";

function StatLine({ label, value }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function SyncScreen({ navigation }) {
  const [cloud, setCloud] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/settings/cloud-sync");
      setCloud(data);
    } catch (_e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trigger = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/settings/cloud-sync/trigger");
      const synced = data.synced ?? 0;
      const failed = data.failed ?? 0;
      if (failed > 0) toast.warning(`${synced} synced · ${failed} failed`);
      else toast.success(synced > 0 ? `Synced ${synced} events` : "Already in sync");
      load();
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Sync status" back navigation={navigation} gap={20} refreshing={false} onRefresh={load}>
      <View>
        <SmallCaps>Sync</SmallCaps>
        <Heading size={22} style={{ marginTop: 4 }}>
          What's queued, <AccentSerif>what's sent.</AccentSerif>
        </Heading>
      </View>

      <Surface padding={24}>
        <SmallCaps>Cloud status</SmallCaps>
        <Ticking size={44} color={cloud?.online ? colors.success : colors.danger} style={{ marginTop: 6 }}>
          {cloud ? (cloud.online ? "Online" : "Offline") : "—"}
        </Ticking>
        {cloud?.last_error ? <Text style={styles.err}>{cloud.last_error}</Text> : null}
        <View style={styles.hair} />
        <StatLine label="Pending events" value={cloud?.pending_count ?? "—"} />
        <StatLine label="Failed (will retry)" value={(cloud?.failed_count || 0) + (cloud?.dead_letter_count || 0)} />
        <StatLine label="Last sync" value={cloud?.last_sync_at ? new Date(cloud.last_sync_at).toLocaleString() : "Never"} />
        <StatLine label="Sync interval" value={`every ${cloud?.interval_sec || 30}s`} />
      </Surface>

      <PrimaryButton
        title="Sync now"
        icon={<RefreshCw size={14} color={colors.ink} strokeWidth={2} />}
        onPress={trigger}
        loading={busy}
        testID="trigger-mobile-sync"
      />

      <Body style={{ textAlign: "center", fontSize: 12 }}>
        All actions you take while offline are queued locally and synced automatically when the connection returns.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  err: { color: colors.danger, fontSize: 12, marginTop: 4 },
  hair: { height: 1, backgroundColor: colors.hairlineSoft, marginTop: 16, marginBottom: 6 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  statLabel: { color: colors.muted, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 10.5, fontWeight: "600" },
  statValue: { color: colors.text, fontWeight: "600", letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
});
