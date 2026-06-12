import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Eye, EyeOff, Settings } from "lucide-react-native";
import { AccentSerif, Body, Input, PrimaryButton, SmallCaps } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getServerUrl, apiErrorMessage } from "../api/client";
import { toast } from "../components/toast";
import { colors } from "../theme";

export function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // Root navigator swaps to the app stack on auth state change.
    } catch (e) {
      toast.error("Login failed", { description: apiErrorMessage(e, "Invalid credentials") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 24 : 0}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.topRow}>
        <Text style={styles.wordmark}>SpotyTags</Text>
        <Pressable
          onPress={() => navigation.navigate("Setup")}
          hitSlop={12}
          testID="login-server-settings"
        >
          <Settings size={20} color={colors.muted} strokeWidth={1.7} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ justifyContent: "center", flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <SmallCaps>Staff sign in</SmallCaps>
        <Text style={styles.title}>
          Welcome back to{"\n"}
          <AccentSerif>the floor.</AccentSerif>
        </Text>
        <Body style={{ marginTop: 12 }}>Sign in with your staff account to continue.</Body>

        <View style={{ marginTop: 28, gap: 14 }}>
          <View style={{ gap: 6 }}>
            <SmallCaps>Email</SmallCaps>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@hotel.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              testID="login-email-input"
            />
          </View>
          <View style={{ gap: 6 }}>
            <SmallCaps>Password</SmallCaps>
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.faint}
                style={styles.passwordInput}
                testID="login-password-input"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                hitSlop={12}
                testID="login-toggle-password"
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.muted} strokeWidth={1.7} />
                ) : (
                  <Eye size={20} color={colors.muted} strokeWidth={1.7} />
                )}
              </Pressable>
            </View>
          </View>
        </View>

        <PrimaryButton
          title="Sign in"
          onPress={submit}
          loading={busy}
          icon={<ArrowRight size={15} color={colors.ink} strokeWidth={2} />}
          style={{ marginTop: 24 }}
          testID="login-submit"
        />
      </ScrollView>

      <Text style={styles.footer} numberOfLines={1}>
        {getServerUrl() || "No server configured"}
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: colors.text, fontWeight: "700", fontSize: 18, letterSpacing: -0.4 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.8, lineHeight: 34, marginTop: 8 },
  footer: { color: colors.faint, fontSize: 11, textAlign: "center", fontVariant: ["tabular-nums"] },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
