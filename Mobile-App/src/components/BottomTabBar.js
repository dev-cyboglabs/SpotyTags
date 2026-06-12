import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Home, QrCode, Layers, ClipboardList, User } from "lucide-react-native";
import { colors } from "../theme";

const ICONS = { Home, Scan: QrCode, Menu: Layers, Tasks: ClipboardList, Profile: User };
const LABELS = { Home: "Today", Scan: "Scan", Menu: "Menu", Tasks: "Tasks", Profile: "You" };

function TabItem({ label, Icon, focused, onPress, testID }) {
  const t = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    t.value = withTiming(focused ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [focused, t]);

  const wrapStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(t.value, [0, 1], ["rgba(255,255,255,0)", "#FFFFFF"]),
      transform: [{ scale: 1 + 0.06 * t.value }],
      borderRadius: 18,
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 + 0.12 * t.value }],
    };
  });

  return (
    <Pressable testID={testID} onPress={onPress} style={styles.item}>
      <Animated.View style={[styles.iconWrap, wrapStyle]}>
        <Animated.View style={iconStyle}>
          <Icon size={18} color={focused ? colors.ink : colors.muted} strokeWidth={1.8} />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.label, { color: focused ? colors.text : colors.faint }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name];
        const label = LABELS[route.name];
        const onPress = () => {
          try {
            Haptics.selectionAsync();
          } catch (_e) {}
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TabItem
            key={route.key}
            testID={`mobile-nav-${label.toLowerCase()}`}
            label={label}
            Icon={Icon}
            focused={focused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.glass,
    borderTopWidth: 1,
    borderTopColor: "rgba(35,35,35,0.8)",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  iconWrapOn: { backgroundColor: "#FFFFFF", borderRadius: 18 },
  label: { fontSize: 8, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
});
