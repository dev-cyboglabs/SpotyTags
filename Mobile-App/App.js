import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { CurrencyProvider } from "./src/context/CurrencyContext";
import { RealtimeProvider } from "./src/context/RealtimeContext";
import { LicenseProvider, useLicenseStatus } from "./src/context/useLicenseStatus";
import { ToastHost } from "./src/components/toast";
import { BottomTabBar } from "./src/components/BottomTabBar";
import { colors } from "./src/theme";

import { SetupScreen } from "./src/screens/SetupScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { MenuScreen } from "./src/screens/MenuScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { AddTagScreen } from "./src/screens/AddTagScreen";
import { AddGatewayScreen } from "./src/screens/AddGatewayScreen";
import { ReportScreen } from "./src/screens/ReportScreen";
import { GatewayDiagScreen } from "./src/screens/GatewayDiagScreen";
import { SyncScreen } from "./src/screens/SyncScreen";
import { RestockRoomScreen } from "./src/screens/RestockRoomScreen";
import { LicenseExpiredScreen } from "./src/screens/LicenseExpiredScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.brand },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { booted, isAuthed, hasServer } = useAuth();
  const { blocked, loading } = useLicenseStatus();

  if (!booted || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  // Show license expired screen if blocked
  if (blocked && isAuthed) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="LicenseExpired" component={LicenseExpiredScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {!isAuthed ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} initialParams={{}} />
          <Stack.Screen name="Setup" component={SetupScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="AddTag" component={AddTagScreen} />
          <Stack.Screen name="AddGateway" component={AddGatewayScreen} />
          <Stack.Screen name="Report" component={ReportScreen} />
          <Stack.Screen name="GatewayDiag" component={GatewayDiagScreen} />
          <Stack.Screen name="Sync" component={SyncScreen} />
          <Stack.Screen name="RestockRoom" component={RestockRoomScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LicenseProvider>
          <CurrencyProvider>
            <RealtimeProvider>
              <NavigationContainer theme={navTheme}>
                <StatusBar style="light" />
                <RootNavigator />
                <ToastHost />
              </NavigationContainer>
            </RealtimeProvider>
          </CurrencyProvider>
        </LicenseProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
