import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

/**
 * Minimal toast — mirrors the `sonner` API used on the web (toast.success / error / warning / info).
 * A single host renders the active toast; module-level emitter lets any screen fire one.
 */
let emit = null;

export const toast = {
  success: (title, opts) => emit?.({ severity: "success", title, ...opts }),
  error: (title, opts) => emit?.({ severity: "error", title, ...opts }),
  warning: (title, opts) => emit?.({ severity: "warning", title, ...opts }),
  info: (title, opts) => emit?.({ severity: "info", title, ...opts }),
};

const TINT = {
  success: colors.success,
  error: colors.danger,
  warning: colors.amber,
  info: colors.text,
};

export function ToastHost() {
  const [item, setItem] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  useEffect(() => {
    emit = (next) => {
      setItem({ ...next, key: Date.now() });
    };
    return () => {
      emit = null;
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        setItem(null)
      );
    }, 2800);
    return () => timer.current && clearTimeout(timer.current);
  }, [item, opacity]);

  if (!item) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <View style={styles.card}>
        <View style={[styles.dot, { backgroundColor: TINT[item.severity] || colors.text }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: colors.text, fontWeight: "600", fontSize: 14 },
  desc: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
