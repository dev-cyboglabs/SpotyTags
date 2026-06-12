import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RefreshCw, Check, BedDouble, AlertOctagon } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import { Body, Hairline, PrimaryButton, SecondaryButton, SmallCaps, Surface, Ticking } from "../components/ui";
import { api, apiErrorMessage } from "../api/client";
import { toast } from "../components/toast";
import { colors, radius } from "../theme";

const TASK_STATUSES = ["tamper_triggered", "low_battery", "not_seen"];

export function TasksScreen({ navigation }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tags");
      setTags(data);
    } catch (_e) {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const restock = async (tag) => {
    try {
      await api.post(`/tags/${tag.id}/restock`, { tag_id: tag.tag_id });
      toast.success(`Restocked ${tag.tag_id}`);
      fetchTags();
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    }
  };

  const tasks = tags.filter((t) => TASK_STATUSES.includes(t.status));
  const count = (s) => tasks.filter((t) => t.status === s).length;

  return (
    <Screen title="Tasks" navigation={navigation} gap={20} refreshing={loading} onRefresh={fetchTags}>
      <View style={styles.headRow}>
        <View>
          <SmallCaps>Pending across all rooms</SmallCaps>
          <Ticking size={48} style={{ marginTop: 4, letterSpacing: -1 }}>{tasks.length}</Ticking>
        </View>
        <SecondaryButton
          title="Refresh"
          icon={<RefreshCw size={14} color={colors.text} strokeWidth={2} />}
          onPress={fetchTags}
          style={styles.refreshBtn}
        />
      </View>
      <Hairline soft />

      {!loading && tasks.length > 0 && (
        <View style={styles.strip}>
          <Surface padding={0} style={styles.stripCard}>
            <SmallCaps>Tamper</SmallCaps>
            <Ticking size={22} color={colors.brandText} style={styles.stripCount}>{count("tamper_triggered")}</Ticking>
          </Surface>
          <Surface padding={0} style={styles.stripCard}>
            <SmallCaps>Low battery</SmallCaps>
            <Ticking size={22} color={colors.amber} style={styles.stripCount}>{count("low_battery")}</Ticking>
          </Surface>
          <Surface padding={0} style={styles.stripCard}>
            <SmallCaps>Not seen</SmallCaps>
            <Ticking size={22} color={colors.muted} style={styles.stripCount}>{count("not_seen")}</Ticking>
          </Surface>
        </View>
      )}

      {!loading && tasks.length === 0 ? (
        <Surface padding={32} style={{ alignItems: "center" }}>
          <View style={styles.okCircle}>
            <Check size={32} color={colors.success} strokeWidth={1.5} />
          </View>
          <Text style={styles.allQuiet}>All quiet.</Text>
          <Body style={{ marginTop: 4 }}>No tasks pending.</Body>
        </Surface>
      ) : (
        <View style={{ gap: 12 }}>
          {tasks.map((t) => (
            <Surface key={t.id} padding={16} testID={`mobile-task-${t.tag_id}`} style={styles.taskCard}>
              <View style={styles.taskMainRow}>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomLabel}>ROOM</Text>
                  <Ticking size={18} style={styles.roomNum}>{t.room_number || "?"}</Ticking>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{t.product_name || t.tag_id}</Text>
                  <View style={styles.metaRow}>
                    <SmallCaps color={colors.faint} style={styles.tagIdText}>{t.tag_id}</SmallCaps>
                    <Text style={styles.divider}>|</Text>
                    <Body style={styles.batteryText}>{t.battery}% battery</Body>
                  </View>
                </View>
                <StatusBadge status={t.status} />
              </View>

              <View style={styles.actionRow}>
                <PrimaryButton
                  title="Mark restocked"
                  icon={<BedDouble size={14} color={colors.ink} strokeWidth={2} />}
                  onPress={() => restock(t)}
                  style={styles.actionBtnPrimary}
                  testID={`mobile-restock-${t.tag_id}`}
                />
                <SecondaryButton
                  title="Report"
                  icon={<AlertOctagon size={14} color={colors.text} strokeWidth={2} />}
                  onPress={() => navigation.navigate("Report", { tagId: t.id })}
                  style={styles.actionBtnSecondary}
                />
              </View>
            </Surface>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refreshBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md },
  strip: { flexDirection: "row", gap: 8, justifyContent: "center" },
  stripCard: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
  stripCount: { marginTop: 4, letterSpacing: -0.5, fontWeight: "700" },
  okCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(31,122,61,0.15)", alignItems: "center", justifyContent: "center" },
  allQuiet: { color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 16, letterSpacing: -0.4 },
  taskCard: { borderRadius: radius.xl, borderColor: colors.border, borderWidth: 1 },
  taskMainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  roomBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  roomLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  roomNum: {
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  taskTitle: { color: colors.text, fontWeight: "600", fontSize: 15, letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  tagIdText: { fontSize: 10, fontWeight: "600" },
  divider: { color: colors.borderSoft, fontSize: 12 },
  batteryText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 12,
  },
  actionBtnPrimary: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  actionBtnSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
});
