import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, mono, radius, serif } from "../theme";

/* ---------------- Typography ---------------- */

export function SmallCaps({ children, style, color }) {
  return <Text style={[styles.smallcaps, color && { color }, style]}>{children}</Text>;
}

export function Ticking({ children, size = 48, style, color }) {
  return (
    <Text
      style={[
        styles.ticking,
        { fontSize: size, lineHeight: size * 0.98 },
        color && { color },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, size = 28, style }) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.05 }, style]}>{children}</Text>;
}

export function AccentSerif({ children, style }) {
  return <Text style={[styles.accentSerif, style]}>{children}</Text>;
}

export function Body({ children, style, color }) {
  return <Text style={[styles.body, color && { color }, style]}>{children}</Text>;
}

export function Mono({ children, style, color }) {
  return <Text style={[styles.monoText, color && { color }, style]}>{children}</Text>;
}

/* ---------------- Surfaces & lines ---------------- */

export function Surface({ children, style, padding = 20 }) {
  return <View style={[styles.surface, { padding }, style]}>{children}</View>;
}

export function Hairline({ soft, style }) {
  return <View style={[{ height: 1, backgroundColor: soft ? colors.hairlineSoft : colors.hairline }, style]} />;
}

/* ---------------- Buttons ---------------- */

function haptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (_e) {
    // haptics unsupported
  }
}

export function PrimaryButton({ title, onPress, disabled, loading, icon, style, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled || loading) return;
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btnPrimary,
        pressed && !disabled && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} size="small" />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={styles.btnPrimaryText}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, icon, style, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled) return;
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btnSecondary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.btnRow}>
        {icon}
        <Text style={styles.btnSecondaryText}>{title}</Text>
      </View>
    </Pressable>
  );
}

/* ---------------- Inputs ---------------- */

export function Input({ style, monospace, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      style={[styles.input, monospace && { fontFamily: mono }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  smallcaps: {
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.muted,
  },
  ticking: {
    fontWeight: "700",
    letterSpacing: -2,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  heading: {
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.text,
  },
  accentSerif: {
    fontFamily: serif,
    fontStyle: "italic",
    color: colors.brand,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
  },
  monoText: {
    fontFamily: mono,
    color: colors.text,
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  btnPrimary: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.4 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
});
