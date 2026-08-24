import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { TopBar } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

import HomeScreen from "../screens/member/HomeScreen";
import OrdersScreen from "../screens/member/OrdersScreen";
import JobsScreen from "../screens/member/JobsScreen";
import ProfileScreen from "../screens/member/ProfileScreen";

const Tab = createBottomTabNavigator();
const ICONS = { Home: "home", Orders: "clipboard", Jobs: "briefcase", Profile: "user" };

export default function MemberTabs() {
  const { session } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <TopBar title={headerTitle(route.name, session)} subtitle={route.name === "Home" ? "GVCDA Member" : undefined} />,
        tabBarActiveTintColor: T.teal,
        tabBarInactiveTintColor: T.inkSoft,
        tabBarIcon: ({ color, size }) => <Feather name={ICONS[route.name]} size={size - 3} color={color} />,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function headerTitle(route, session) {
  if (route === "Home") return `Namaste, ${(session?.user?.full_name || "Member").split(" ")[0]}`;
  return route;
}
