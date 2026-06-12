import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors, radius } from "../theme";

/**
 * Row tile used across Home / Menu / Profile — icon box, title, hint, chevron.
 * `accent`: "brand" | "cream" | default.
 */
export function ActionTile({ icon: Icon, title, hint, accent, onPress, disabled, testID }) {
  const iconWrapStyle = { backgroundColor: colors.chip };
  const iconColor = accent === "brand" ? "#FFFFFF" : accent === "cream" ? colors.ink : colors.text;

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: "#181818" }, disabled && styles.disabled]}
    >
      <View style={[styles.iconWrap, iconWrapStyle]}>
        <Icon size={20} color={iconColor} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <ChevronRight size={16} color={colors.faint} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontWeight: "600", fontSize: 15, letterSpacing: -0.3 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
