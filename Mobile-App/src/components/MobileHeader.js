import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react-native";
import { colors } from "../theme";
import { useRealtime } from "../context/RealtimeContext";

export function MobileHeader({ title, back, navigation }) {
  const insets = useSafeAreaInsets();
  const { connected } = useRealtime();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.side}>
        {back ? (
          <Pressable
            testID="mobile-back"
            onPress={() => navigation?.goBack()}
            style={styles.backBtn}
            hitSlop={10}
          >
            <ArrowLeft size={14} color={colors.text} strokeWidth={2} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.wordmarkWrap}>
            <Text style={styles.wordmark}>Spoty</Text>
            <Text style={[styles.wordmark, styles.wordmarkAccent]}>Tags</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.side, { alignItems: "flex-end" }]}>
        <View style={styles.wifi}>
          {connected ? (
            <Wifi size={16} color={colors.text} strokeWidth={2.2} />
          ) : (
            <WifiOff size={16} color={colors.danger} strokeWidth={2.2} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.glass,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(35,35,35,0.8)",
    gap: 12,
  },
  side: { width: 70, justifyContent: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: {
    color: colors.text,
    opacity: 0.7,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wordmarkWrap: { flexDirection: "row", alignItems: "baseline" },
  wordmark: { color: colors.text, fontWeight: "700", fontSize: 15, letterSpacing: -0.3 },
  wordmarkAccent: { color: colors.brand },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  wifi: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
