import { useEffect } from "react";
import { StyleSheet, Text, View, Image } from "react-native";
import { Cloud, LogOut } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { ActionTile } from "../components/ActionTile";
import { Body, Hairline, PrimaryButton, SmallCaps, Surface } from "../components/ui";
import { useAuth, ROLE_LABELS } from "../context/AuthContext";
import { colors } from "../theme";

function StatLine({ label, value }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function ProfileScreen({ navigation }) {
  const { user, logout, hotelName, getAbsoluteLogoUrl, refreshBranding } = useAuth();

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      refreshBranding();
    });
    return unsubscribe;
  }, [navigation, refreshBranding]);

  const initials = (user?.name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const logoUri = getAbsoluteLogoUrl();

  return (
    <Screen title="You" navigation={navigation} gap={28}>
      <Surface padding={24} style={{ alignItems: "center" }}>
        <View style={styles.avatar}>
          {logoUri ? (
            <Image
              source={{ uri: logoUri }}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Body style={{ marginTop: 2 }}>{user?.email}</Body>
      </Surface>

      <View>
        <SmallCaps style={{ marginBottom: 12 }}>Account details</SmallCaps>
        <Hairline soft style={{ marginBottom: 4 }} />
        <StatLine label="Role" value={ROLE_LABELS[user?.role] || "—"} />
        <StatLine label="Property" value={hotelName} />
        <StatLine
          label="Member since"
          value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
        />
      </View>

      <ActionTile
        icon={Cloud}
        title="Sync status"
        hint="Offline queue + cloud"
        onPress={() => navigation.navigate("Sync")}
        testID="profile-sync-link"
      />

      <PrimaryButton
        title="Sign out"
        icon={<LogOut size={14} color={colors.ink} strokeWidth={2} />}
        onPress={logout}
        testID="mobile-logout"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarText: { color: colors.ink, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  name: { color: colors.text, fontSize: 19, fontWeight: "700", marginTop: 14, letterSpacing: -0.4 },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  statLabel: { color: colors.muted, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 10.5, fontWeight: "600" },
  statValue: { color: colors.text, fontWeight: "600", letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
});
