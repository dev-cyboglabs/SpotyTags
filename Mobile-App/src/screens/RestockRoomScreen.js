import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { QrCode, BedDouble } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import { Body, Hairline, Mono, PrimaryButton, SecondaryButton, SmallCaps, Surface, Ticking } from "../components/ui";
import { api, apiErrorMessage } from "../api/client";
import { toast } from "../components/toast";
import { colors } from "../theme";

export function RestockRoomScreen({ navigation, route }) {
  const roomId = route?.params?.roomId;
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}`);
      setRoom(data);
    } catch (_e) {
      toast.error("Room not found");
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const restock = async (tagId) => {
    setBusy(true);
    try {
      await api.post(`/tags/${tagId}/restock`, { tag_id: tagId });
      toast.success("Restocked");
      fetchRoom();
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={room ? `Room ${room.room_number}` : "Restock"} back navigation={navigation} gap={20}>
      {!room ? (
        <Body>Loading room…</Body>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 16 }}>
            <Ticking size={56}>{room.room_number}</Ticking>
            <View>
              <SmallCaps>Restock checklist</SmallCaps>
              <Text style={styles.roomType}>{room.room_type} · Floor {room.floor}</Text>
            </View>
          </View>

          <View>
            <SmallCaps style={{ marginBottom: 12 }}>Minibar contents</SmallCaps>
            <Hairline soft style={{ marginBottom: 12 }} />
            {(room.tags || []).length === 0 ? (
              <Body style={{ paddingVertical: 16 }}>No tags in this room.</Body>
            ) : (
              <View style={{ gap: 8 }}>
                {room.tags.map((t) => (
                  <Surface key={t.id} padding={16}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.prodName}>{t.product?.name || t.tag_id}</Text>
                        <Mono color={colors.faint} style={{ fontSize: 11, marginTop: 2 }}>{t.tag_id} · {t.battery}%</Mono>
                      </View>
                      <StatusBadge status={t.status} />
                    </View>
                    {(t.status === "tamper_triggered" || t.status === "low_battery") && (
                      <PrimaryButton
                        title="Mark restocked"
                        icon={<BedDouble size={12} color={colors.ink} strokeWidth={2} />}
                        onPress={() => restock(t.id)}
                        disabled={busy}
                        style={{ marginTop: 12, paddingVertical: 10 }}
                      />
                    )}
                  </Surface>
                ))}
              </View>
            )}
          </View>

          <SecondaryButton
            title="Scan to add a new tag"
            icon={<QrCode size={14} color={colors.text} strokeWidth={2} />}
            onPress={() => navigation.navigate("Scan")}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  roomType: { color: colors.text, fontWeight: "500", letterSpacing: -0.3, marginTop: 2 },
  prodName: { color: colors.text, fontWeight: "600", letterSpacing: -0.3 },
});
