import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius } from "../theme";

/** Big square quick-action button used on Home (cream or dark). */
export function QuickAction({ icon: Icon, label, cream, onPress, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_e) {
          // ignore
        }
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.box,
        cream ? styles.cream : styles.dark,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <Icon size={28} color={cream ? colors.ink : colors.text} strokeWidth={1.5} />
      <Text style={[styles.label, { color: cream ? colors.ink : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}
// quick actoin 2 btns
const styles = StyleSheet.create({
  box: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
  },
  cream: { backgroundColor: colors.cream },
  dark: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { textTransform: "uppercase", letterSpacing: 1.2, fontSize: 10, fontWeight: "600" },
});
