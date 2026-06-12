import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { colors } from "../theme";
import { useLicenseStatus } from "../context/useLicenseStatus";
import { getServerUrl } from "../api/client";

export function LicenseExpiredScreen() {
  const { blocked, block_reason, status, expiry_date, plan, checkLicense } = useLicenseStatus();

  const handleManageLicense = () => {
    Linking.openURL(`${getServerUrl()}/license`);
  };

  const handleRetry = () => {
    checkLicense();
  };

  if (!blocked) {
    return null; // Should not happen, but safety check
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚠️</Text>
      </View>

      <Text style={styles.title}>License {block_reason || "Expired"}</Text>
      
      <Text style={styles.message}>
        Your SpotyTags license is currently {block_reason || "expired"}. Please renew or extend your plan to continue using the application.
      </Text>

      {expiry_date && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Expired on:</Text>
          <Text style={styles.infoValue}>
            {new Date(expiry_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      )}

      {plan && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Plan:</Text>
          <Text style={styles.infoValue}>{plan}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={handleManageLicense}>
        <Text style={styles.primaryButtonText}>Manage License</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
        <Text style={styles.secondaryButtonText}>Retry</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Contact support if you believe this is an error.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: colors.faint,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
    color: colors.faint,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    fontSize: 12,
    color: colors.faint,
    textAlign: "center",
    marginTop: 24,
  },
});
