import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Server } from "lucide-react-native";
import { AccentSerif, Body, Input, PrimaryButton, SecondaryButton, SmallCaps } from "../components/ui";
import { getServerUrl, setServerUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { toast } from "../components/toast";
import { colors } from "../theme";

export function SetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { setHasServer } = useAuth();
  const [url, setUrl] = useState(getServerUrl());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = (url || "").trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("Enter a valid URL", { description: "Include http:// or https://" });
      return;
    }
    setBusy(true);
    await setServerUrl(trimmed);
    setHasServer(true);
    setBusy(false);
    toast.success("Server saved");
    navigation.replace("Login");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.iconWrap}>
        <Server size={30} color={colors.brand} strokeWidth={1.5} />
      </View>
      <SmallCaps style={{ marginTop: 28 }}>Setup</SmallCaps>
      <Text style={styles.title}>
        Connect to your{"\n"}
        <AccentSerif>hotel server.</AccentSerif>
      </Text>
      <Body style={{ marginTop: 12 }}>
        Enter the LAN or cloud address of your SpotyTags server. Ask your IT admin if unsure.
      </Body>

      <View style={{ marginTop: 28, gap: 6 }}>
        <SmallCaps>Server URL</SmallCaps>
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.50:8001"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          monospace
          testID="setup-url-input"
        />
      </View>

      <View style={{ flex: 1 }} />

      <PrimaryButton title="Save & continue" onPress={save} loading={busy} testID="setup-save" />
      {getServerUrl() ? (
        <SecondaryButton title="Cancel" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,126,107,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.8, lineHeight: 34, marginTop: 8 },
});
