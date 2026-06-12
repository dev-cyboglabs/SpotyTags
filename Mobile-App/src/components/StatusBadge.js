import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

/** Status pill config — ported from web StatusBadge.jsx (mobile-relevant statuses). */
const STATUS_CONFIG = {
  // Room
  vacant: { label: "Vacant", fg: "#5BC97E", bg: "rgba(91,201,126,0.12)" },
  occupied: { label: "Occupied", fg: "#C8C1B0", bg: "rgba(200,193,176,0.10)" },
  checkout_pending: { label: "Checkout Pending", fg: "#FFB661", bg: "rgba(255,182,97,0.12)" },
  cleaning: { label: "Cleaning", fg: "#C8C1B0", bg: "rgba(200,193,176,0.10)" },
  maintenance: { label: "Maintenance", fg: "#FFB661", bg: "rgba(255,182,97,0.12)" },
  // Tag
  unassigned: { label: "Unassigned", fg: "#8E887D", bg: "rgba(142,136,125,0.12)" },
  assigned: { label: "Assigned", fg: "#C8C1B0", bg: "rgba(200,193,176,0.10)" },
  active: { label: "Active", fg: "#5BC97E", bg: "rgba(91,201,126,0.12)" },
  tamper_triggered: { label: "Tamper", fg: "#FF9B7E", bg: "rgba(255,155,126,0.12)" },
  low_battery: { label: "Low Battery", fg: "#FFB661", bg: "rgba(255,182,97,0.12)" },
  not_seen: { label: "Not Seen", fg: "#8E887D", bg: "rgba(142,136,125,0.12)" },
  faulty: { label: "Faulty", fg: "#FF9B7E", bg: "rgba(255,155,126,0.12)" },
  lost: { label: "Lost", fg: "#FF9B7E", bg: "rgba(255,155,126,0.12)" },
  retired: { label: "Retired", fg: "#8E887D", bg: "rgba(142,136,125,0.12)" },
  // Gateway
  online: { label: "Online", fg: "#5BC97E", bg: "rgba(91,201,126,0.12)" },
  offline: { label: "Offline", fg: "#FF9B7E", bg: "rgba(255,155,126,0.12)" },
  weak_signal: { label: "Weak Signal", fg: "#FFB661", bg: "rgba(255,182,97,0.12)" },
  not_configured: { label: "Not Configured", fg: "#8E887D", bg: "rgba(142,136,125,0.12)" },
};

export function StatusBadge({ status, testID }) {
  const cfg = STATUS_CONFIG[status] || { label: status, fg: colors.muted, bg: "rgba(142,136,125,0.12)" };
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]} testID={testID || `status-${status}`}>
      <View style={[styles.dot, { backgroundColor: cfg.fg }]} />
      <Text style={[styles.label, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: -0.2 },
});
