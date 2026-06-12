import { useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import LottieView from "lottie-react-native";
import {
  QrCode, ArrowRight, ArrowLeft, Check, X, Camera as CameraIcon,
} from "lucide-react-native";
import { Screen } from "../components/Screen";
import { Stepper } from "../components/Stepper";
import { StatusBadge } from "../components/StatusBadge";
import {
  Body, Input, Mono, PrimaryButton, SecondaryButton, SmallCaps, Surface, Ticking,
} from "../components/ui";
import { api, apiErrorMessage } from "../api/client";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "../components/toast";
import tickAnimation from "../../assets/qr-tick.json";
import { colors, radius } from "../theme";

export function ScanScreen({ navigation }) {
  const { format } = useCurrency();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const lockRef = useRef(false);

  const [step, setStep] = useState(0);
  const [tagId, setTagId] = useState("");
  const [tag, setTag] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [products, setProducts] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [productId, setProductId] = useState("");
  const [sticker, setSticker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // Custom Scrollbar States
  const [roomScrollY, setRoomScrollY] = useState(0);
  const [roomContentHeight, setRoomContentHeight] = useState(1);
  const [roomLayoutHeight, setRoomLayoutHeight] = useState(1);

  const [productScrollY, setProductScrollY] = useState(0);
  const [productContentHeight, setProductContentHeight] = useState(1);
  const [productLayoutHeight, setProductLayoutHeight] = useState(1);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const selectedProduct = products.find((p) => p.id === productId);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const lookup = async (value) => {
    const id = (value || tagId).trim();
    if (!id) return;
    setBusy(true);
    try {
      const { data: found } = await api.get(`/tags/by-tag-id/${encodeURIComponent(id)}`);
      setTag(found);
      const [r, p] = await Promise.all([api.get("/rooms"), api.get("/products?active=true")]);
      const sortedRooms = r.data.sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.room_number - b.room_number;
      });
      setRooms(sortedRooms);
      setProducts(p.data);
      setStep(1);
    } catch (e) {
      toast.error(e.response?.status === 404 ? "Tag not found" : "Lookup failed", {
        description: e.response?.status === 404 ? undefined : apiErrorMessage(e),
      });
    } finally {
      setBusy(false);
      setScanning(false);
      lockRef.current = false;
    }
  };

  const onBarcode = ({ data }) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const value = (data || "").toUpperCase();
    setTagId(value);
    lookup(value);
  };

  const assign = async () => {
    if (!roomId) return toast.error("Pick a room");
    if (!productId) return toast.error("Pick a product");
    if (!sticker) return toast.error("Confirm sticker seal replaced");
    setBusy(true);
    try {
      await api.post(`/tags/${tag.id}/assign`, { room_id: roomId, product_id: productId, sticker_replaced: true });
      toast.success("Assigned", {
        description: `${selectedProduct?.name} → Room ${selectedRoom?.room_number}`,
      });
      setStep(3);
    } catch (e) {
      toast.error("Failed", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setTagId("");
    setTag(null);
    setRoomId("");
    setProductId("");
    setSticker(false);
    setScanning(false);
    lockRef.current = false;
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        toast.error("Camera permission denied");
        return;
      }
    }
    lockRef.current = false;
    setScanning(true);
  };

  return (
    <Screen
      title="Scan & assign"
      back
      navigation={navigation}
      gap={20}
      scrollable={step !== 1 && step !== 2 && step !== 3}
      contentStyle={(step === 1 || step === 2 || step === 3) ? { paddingBottom: 16 } : undefined}
    >
      <Stepper steps={["Scan", "Room", "Product", "Done"]} current={step} />

      {step === 0 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : "position"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 120}
          style={{ width: "100%" }}
        >
          {scanning ? (
            <View style={styles.cameraWrap}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8"] }}
                onBarcodeScanned={onBarcode}
              />
              <View style={styles.reticle} />
              <Pressable style={styles.cameraClose} onPress={() => setScanning(false)}>
                <X size={18} color={colors.text} />
              </Pressable>
            </View>
          ) : (
            <Surface padding={28} style={{ alignItems: "center", height: 260, justifyContent: "center" }}>
              <View style={styles.qrIcon}>
                <QrCode size={40} color={colors.brand} strokeWidth={1.4} />
              </View>
              <Text style={styles.scanTitle}>Scan the QR</Text>
              <Body style={{ marginTop: 2 }}>or enter the tag ID</Body>
            </Surface>
          )}

          <PrimaryButton
            title={scanning ? "Scanning…" : "Open camera"}
            icon={<CameraIcon size={15} color={colors.ink} strokeWidth={2} />}
            onPress={openCamera}
            disabled={scanning}
            style={{ marginTop: 16 }}
            testID="mobile-open-camera"
          />

          <View style={{ gap: 8, marginTop: 16 }}>
            <SmallCaps>Tag ID</SmallCaps>
            <Input
              value={tagId}
              onChangeText={(t) => setTagId(t.toUpperCase())}
              placeholder="ST-000001"
              autoCapitalize="characters"
              autoCorrect={false}
              monospace
              style={styles.bigInput}
              testID="mobile-tag-id-input"
            />
          </View>

          <PrimaryButton
            title="Look up tag"
            icon={<ArrowRight size={15} color={colors.ink} strokeWidth={2} />}
            onPress={() => lookup()}
            disabled={!tagId || busy}
            loading={busy}
            style={{ marginTop: 16 }}
            testID="mobile-lookup-tag"
          />
          <Body style={{ textAlign: "center", marginTop: 16 }}>
            Try <Mono color={colors.text}>ST-000013</Mono> — it's unassigned.
          </Body>
        </KeyboardAvoidingView>
      )}

      {step === 1 && tag && (
        <View style={{ flex: 1, flexDirection: "column" }}>
          <Surface>
            <SmallCaps>Tag found</SmallCaps>
            <Mono style={styles.tagFound}>{tag.tag_id}</Mono>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
              <StatusBadge status={tag.status} />
              <SmallCaps color={colors.faint}>battery {tag.battery}%</SmallCaps>
            </View>
          </Surface>

          <View style={{ flex: 1, marginTop: 15 }}>
            <View style={styles.between}>
              <SmallCaps>Select room</SmallCaps>
              <Mono color={colors.faint} style={{ fontSize: 12 }}>{rooms.length} rooms</Mono>
            </View>
            <View style={{ flex: 1, flexDirection: "row" }}>
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                onScroll={(e) => setRoomScrollY(e.nativeEvent.contentOffset.y)}
                onContentSizeChange={(w, h) => setRoomContentHeight(h || 1)}
                onLayout={(e) => setRoomLayoutHeight(e.nativeEvent.layout.height || 1)}
                scrollEventThrottle={16}
              >
                <View style={styles.grid3}>
                  {rooms.map((r) => {
                    const on = roomId === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => setRoomId(r.id)}
                        style={[styles.roomCell, on ? styles.cellOn : styles.cellOff]}
                        testID={`mobile-room-${r.room_number}`}
                      >
                        <Ticking size={22} color={on ? colors.ink : colors.text}>{r.room_number}</Ticking>
                        <Text style={[styles.roomFloor, { color: on ? colors.ink : colors.muted }]}>Floor {r.floor}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {roomContentHeight > roomLayoutHeight && (
                <View style={{ width: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 2, marginLeft: 8, height: "100%", position: "relative" }}>
                  <View
                    style={{
                      position: "absolute",
                      width: 4,
                      height: `${Math.max(20, (roomLayoutHeight / roomContentHeight) * 100)}%`,
                      top: `${(roomScrollY / roomContentHeight) * 100}%`,
                      backgroundColor: "rgba(255,255,255,0.35)",
                      borderRadius: 2,
                    }}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={[styles.row2, { marginTop: 12 }]}>
            <SecondaryButton
              title="Cancel"
              icon={<X size={14} color={colors.text} strokeWidth={2} />}
              onPress={reset}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Next"
              icon={<ArrowRight size={14} color={colors.ink} strokeWidth={2} />}
              onPress={() => setStep(2)}
              disabled={!roomId}
              style={{ flex: 1 }}
              testID="next-to-product"
            />
          </View>
        </View>
      )}

      {step === 2 && tag && (
        <View style={{ flex: 1, flexDirection: "column" }}>
          <Surface padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ticking size={36}>{selectedRoom?.room_number}</Ticking>
              <View>
                <SmallCaps>Selected room</SmallCaps>
                <Text style={[styles.roomType, { color: colors.brand }]}>{selectedRoom?.room_type} · Floor {selectedRoom?.floor}</Text>
              </View>
            </View>
          </Surface>

          <View style={{ flex: 1, marginTop: 15 }}>
            <View style={styles.between}>
              <SmallCaps>Choose product</SmallCaps>
              <Mono color={colors.faint} style={{ fontSize: 12 }}>{products.length} items</Mono>
            </View>
            <Input
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Search products..."
              style={{ marginBottom: 12 }}
              testID="mobile-product-search"
            />
            <View style={{ flex: 1, flexDirection: "row" }}>
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                onScroll={(e) => setProductScrollY(e.nativeEvent.contentOffset.y)}
                onContentSizeChange={(w, h) => setProductContentHeight(h || 1)}
                onLayout={(e) => setProductLayoutHeight(e.nativeEvent.layout.height || 1)}
                scrollEventThrottle={16}
              >
                <View style={{ gap: 8 }}>
                  {filteredProducts.map((p) => {
                    const on = productId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setProductId(p.id)}
                        style={[styles.productRow, on ? styles.cellOnBorder : styles.cellOff]}
                        testID={`mobile-product-${p.id}`}
                      >
                        <View style={[styles.radioButton, on ? styles.radioButtonOn : styles.radioButtonOff]}>
                          {on && <View style={styles.radioButtonFill} />}
                        </View>
                        <View style={styles.thumb}>
                          {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.thumbImg} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prodName}>{p.name}</Text>
                          <SmallCaps color={colors.faint}>{p.bottle_size}</SmallCaps>
                        </View>
                        <Text style={styles.price}>{format(p.selling_price)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {productContentHeight > productLayoutHeight && (
                <View style={{ width: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 2, marginLeft: 8, height: "100%", position: "relative" }}>
                  <View
                    style={{
                      position: "absolute",
                      width: 4,
                      height: `${Math.max(20, (productLayoutHeight / productContentHeight) * 100)}%`,
                      top: `${(productScrollY / productContentHeight) * 100}%`,
                      backgroundColor: "rgba(255,255,255,0.35)",
                      borderRadius: 2,
                    }}
                  />
                </View>
              )}
            </View>
          </View>

          <Pressable
            onPress={() => setSticker((s) => !s)}
            style={[styles.sticker, sticker ? styles.stickerOn : styles.cellOff]}
            testID="confirm-sticker"
          >
            <View style={[styles.checkbox, sticker && styles.checkboxOn]}>
              {sticker ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
            </View>
            <View>
              <Text style={styles.stickerTitle}>New sticker seal applied</Text>
              <Body style={{ fontSize: 12 }}>Required before assigning a new product</Body>
            </View>
          </Pressable>

          <View style={[styles.row2, { marginTop: 12 }]}>
            <SecondaryButton
              title="Back"
              icon={<ArrowLeft size={14} color={colors.text} strokeWidth={2} />}
              onPress={() => setStep(1)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Confirm"
              icon={<Check size={14} color={colors.ink} strokeWidth={2} />}
              onPress={assign}
              disabled={busy || !productId || !sticker}
              loading={busy}
              style={{ flex: 1 }}
              testID="mobile-confirm-assign"
            />
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 36 }}>
          <LottieView
            source={tickAnimation}
            autoPlay
            loop={false}
            style={{ width: 150, height: 150 }}
          />
          <Text style={[styles.doneTitle, { marginTop: -2 }]}>Assigned!</Text>
          <Body style={{ textAlign: "center", marginTop: 8, maxWidth: 280 }}>
            {selectedProduct?.name} is now active in Room {selectedRoom?.room_number}.
          </Body>
          <View style={[styles.row2, { marginTop: 28, alignSelf: "stretch", paddingHorizontal: 20 }]}>
            <SecondaryButton title="Home" onPress={() => navigation.navigate("Home")} style={{ flex: 1 }} testID="mobile-go-home" />
            <PrimaryButton title="Scan another" onPress={reset} style={{ flex: 1 }} testID="mobile-scan-another" />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 260,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: colors.border,
  },
  reticle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 180,
    height: 180,
    marginLeft: -90,
    marginTop: -90,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 20,
  },
  cameraClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  qrIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255,126,107,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  scanTitle: { color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  bigInput: { fontSize: 26, textAlign: "center", paddingVertical: 16, borderRadius: radius.lg },
  tagFound: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 4 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  grid3: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomCell: {
    width: "31.5%",
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  cellOn: { backgroundColor: colors.cream, borderColor: colors.cream },
  cellOnBorder: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: colors.brand },
  cellOff: { backgroundColor: colors.surface, borderColor: colors.border },
  roomFloor: { textTransform: "uppercase", letterSpacing: 0.6, fontSize: 8, marginTop: 2, fontWeight: "600" },
  row2: { flexDirection: "row", gap: 12 },
  roomType: { color: colors.text, fontWeight: "500", letterSpacing: -0.3 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonOff: { borderColor: colors.border },
  radioButtonOn: { borderColor: colors.brand },
  radioButtonFill: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.chip, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  prodName: { color: colors.text, fontWeight: "600", letterSpacing: -0.3 },
  price: { color: colors.text, fontWeight: "700", fontSize: 17, fontVariant: ["tabular-nums"], letterSpacing: -0.4 },
  sticker: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1 },
  stickerOn: { borderColor: colors.success, backgroundColor: "rgba(31,122,61,0.1)" },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: "#3A3A3A", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.successDeep, borderColor: colors.success },
  stickerTitle: { color: colors.text, fontWeight: "600", fontSize: 14, letterSpacing: -0.3 },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(31,122,61,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 24, letterSpacing: -0.6 },
});
