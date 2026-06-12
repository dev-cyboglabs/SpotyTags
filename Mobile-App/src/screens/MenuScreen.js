import { View } from "react-native";
import {
  ScanLine, Plus, FileWarning, ShieldOff, Stethoscope, ClipboardList, Cloud, User,
} from "lucide-react-native";
import { Screen } from "../components/Screen";
import { ActionTile } from "../components/ActionTile";
import { AccentSerif, Body, Hairline, Heading, SmallCaps } from "../components/ui";
import { useAuth, canAccess } from "../context/AuthContext";

export function MenuScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role;

  const sections = [
    {
      title: "Tag operations",
      visible: canAccess(role, ["hotel_admin", "technician", "housekeeping"]),
      items: [
        { icon: ScanLine, title: "Scan & assign tag", hint: "QR scan → room → product", go: ["Scan"], visible: true },
        { icon: Plus, title: "Add new tag", hint: "Register a new IN100 BLE tag", accent: "brand", go: ["AddTag"], visible: canAccess(role, ["hotel_admin", "technician"]) },
        { icon: FileWarning, title: "Report damaged tag", hint: "Mark a tag as faulty", go: ["Report", { type: "damaged" }], visible: true },
        { icon: ShieldOff, title: "Report missing tag", hint: "Mark a tag as lost", go: ["Report", { type: "missing" }], visible: true },
      ],
    },
    {
      title: "Gateway operations",
      visible: canAccess(role, ["hotel_admin", "technician"]),
      items: [
        { icon: Plus, title: "Add gateway", hint: "Register an ESP32 device", accent: "brand", go: ["AddGateway"], visible: true },
        { icon: Stethoscope, title: "Gateway diagnostics", hint: "Test connectivity + tags", go: ["GatewayDiag"], visible: true },
      ],
    },
    {
      title: "Housekeeping",
      visible: canAccess(role, ["hotel_admin", "housekeeping"]),
      items: [
        { icon: ClipboardList, title: "Tasks pending", hint: "Restock, replace, attend", go: ["Tasks"], visible: true },
      ],
    },
    {
      title: "System",
      visible: true,
      items: [
        { icon: Cloud, title: "Sync status", hint: "Offline queue + last sync", go: ["Sync"], visible: true },
        { icon: User, title: "Profile", hint: "Account · sign out", go: ["Profile"], visible: true },
      ],
    },
  ];

  return (
    <Screen title="Workflows" navigation={navigation} gap={28}>
      <View>
        <SmallCaps style={{ marginBottom: 8 }}>Staff menu</SmallCaps>
        <Heading size={30}>
          Everything you can do{"\n"}
          <AccentSerif>from the floor.</AccentSerif>
        </Heading>
        <Body style={{ marginTop: 12 }}>A short index. Tap any workflow to begin.</Body>
      </View>

      {sections
        .filter((s) => s.visible)
        .map((section) => {
          const items = section.items.filter((i) => i.visible);
          if (!items.length) return null;
          return (
            <View key={section.title} style={{ gap: 8 }}>
              <SmallCaps style={{ marginBottom: 4 }}>{section.title}</SmallCaps>
              <Hairline soft style={{ marginBottom: 4 }} />
              {items.map((it) => (
                <ActionTile
                  key={it.title}
                  icon={it.icon}
                  title={it.title}
                  hint={it.hint}
                  accent={it.accent}
                  onPress={() => navigation.navigate(...it.go)}
                />
              ))}
            </View>
          );
        })}
    </Screen>
  );
}
