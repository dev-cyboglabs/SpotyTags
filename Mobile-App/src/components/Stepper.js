import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

/** Step indicator row — ported from the web stepper used in Scan / AddTag / AddGateway. */
export function Stepper({ steps, current }) {
  return (
    <View style={styles.row}>
      {steps.map((s, i) => {
        const done = i <= current;
        return (
          <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.seg}>
              <View style={[styles.num, done ? styles.numOn : styles.numOff]}>
                <Text style={[styles.numText, { color: done ? colors.ink : colors.faint }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.label, { color: i === current ? colors.text : colors.faint }]}>{s}</Text>
            </View>
            {i < steps.length - 1 && <View style={styles.line} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", flexWrap: "wrap", columnGap: 2 },
  seg: { flexDirection: "row", alignItems: "center", gap: 5 },
  num: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  numOn: { backgroundColor: colors.cream },
  numOff: { backgroundColor: colors.chip },
  numText: { fontSize: 9, fontWeight: "700" },
  label: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  line: { width: 22, height: 1, backgroundColor: colors.border, marginHorizontal: 6 },
});
