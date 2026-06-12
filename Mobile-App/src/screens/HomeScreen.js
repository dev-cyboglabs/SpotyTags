import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScanLine, ClipboardList, Plus, Router, AlertOctagon, ChevronRight } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { ActionTile } from "../components/ActionTile";
import { AccentSerif, Body, Hairline, Heading, SmallCaps, Surface, Ticking } from "../components/ui";
import { QuickAction } from "../components/QuickAction";
import { api } from "../api/client";
import { useAuth, ROLE_LABELS, canAccess } from "../context/AuthContext";
import { colors } from "../theme";

export function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [kpi, setKpi] = useState(null);
  const [recent, setRecent] = useState({ audits: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/dashboard/kpi"), api.get("/dashboard/recent")]);
      setKpi(a.data);
      setRecent(b.data);
    } catch (_e) {
      // surfaced by toast elsewhere
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const role = user?.role;
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <Screen title="Today" navigation={navigation} gap={28} refreshing={refreshing} onRefresh={onRefresh}>
      {/* Greeting */}
      <View>
        <SmallCaps>{greeting} · {weekday}</SmallCaps>
        <Heading size={30} style={{ marginTop: 8 }}>
          {firstName},{"\n"}
          <AccentSerif>the floor is ready.</AccentSerif>
        </Heading>
        <Body style={{ marginTop: 8 }}>{ROLE_LABELS[role]}</Body>
      </View>

      {/* Hero metric */}
      <Surface padding={24}>
        <SmallCaps>Tasks pending</SmallCaps>
        <Ticking size={68} style={{ marginTop: 6 }}>
          {kpi ? kpi.low_battery_tags + kpi.tags_not_seen : "—"}
        </Ticking>
        <Hairline soft style={{ marginTop: 12, marginBottom: 14 }} />
        <Body>
          {kpi
            ? `${kpi.pending_bills} bill${kpi.pending_bills === 1 ? "" : "s"} awaiting reception, ${kpi.active_tags} tags listening.`
            : "Loading floor status…"}
        </Body>
      </Surface>

      {/* Quick actions */}
      <View>
        <SmallCaps style={{ marginBottom: 12 }}>Quick actions</SmallCaps>
        <View style={styles.quickRow}>
          <QuickAction
            icon={ScanLine}
            label="Scan a tag"
            cream
            onPress={() => navigation.navigate("Scan")}
            testID="mobile-scan-shortcut"
          />
          <QuickAction
            icon={ClipboardList}
            label="View tasks"
            onPress={() => navigation.navigate("Tasks")}
            testID="mobile-tasks-shortcut"
          />
        </View>
      </View>

      {/* Workflows */}
      <View style={{ gap: 8 }}>
        <SmallCaps style={{ marginBottom: 4 }}>Workflows</SmallCaps>
        {canAccess(role, ["hotel_admin", "technician"]) && (
          <ActionTile
            icon={Plus}
            title="Add new tag"
            hint="Register an IN100 BLE tag"
            onPress={() => navigation.navigate("AddTag")}
            testID="quick-add-tag"
          />
        )}
        {canAccess(role, ["hotel_admin", "technician"]) && (
          <ActionTile
            icon={Router}
            title="Add gateway"
            hint="Register an ESP32 gateway"
            onPress={() => navigation.navigate("AddGateway")}
            testID="quick-add-gateway"
          />
        )}
        <ActionTile
          icon={AlertOctagon}
          title="Report an issue"
          hint="Damaged tag, missing bottle…"
          onPress={() => navigation.navigate("Report", {})}
          testID="quick-report"
        />
        <ActionTile
          icon={ChevronRight}
          title="All workflows"
          hint="See the full staff menu"
          onPress={() => navigation.navigate("Menu")}
          testID="quick-menu"
        />
      </View>

      {/* Recent activity */}
      <View>
        <SmallCaps style={{ marginBottom: 12 }}>Recent activity</SmallCaps>
        <Hairline soft style={{ marginBottom: 4 }} />
        {recent.audits?.length ? (
          recent.audits.slice(0, 5).map((a) => (
            <View key={a.id} style={styles.activityRow}>
              <Text style={styles.activityTime}>
                {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={styles.activityText}>{a.description}</Text>
            </View>
          ))
        ) : (
          <Body style={{ paddingVertical: 12 }}>Quiet so far.</Body>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: "row", gap: 12 },
  activityRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  activityTime: { color: colors.faint, fontSize: 11, width: 48, fontWeight: "600" },
  activityText: { color: colors.text, fontSize: 14, flex: 1, fontWeight: "500", lineHeight: 19 },
});
