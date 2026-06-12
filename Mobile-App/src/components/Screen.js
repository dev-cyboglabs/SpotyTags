import { RefreshControl, ScrollView, View } from "react-native";
import { MobileHeader } from "./MobileHeader";
import { colors } from "../theme";

/** Standard screen scaffold: glass header + scrollable padded body. */
export function Screen({ title, back, navigation, children, gap = 24, refreshing, onRefresh, contentStyle, scrollable = true }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MobileHeader title={title} back={back} navigation={navigation} />
      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ padding: 20, paddingBottom: 48, gap }, contentStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20, paddingBottom: 48, gap }, contentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}
