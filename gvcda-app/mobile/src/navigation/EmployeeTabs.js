import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { TopBar } from "../components/ui";
import { T } from "../theme";

import DashboardScreen from "../screens/employee/DashboardScreen";
import MyBookScreen from "../screens/employee/MyBookScreen";
import IncentivesScreen from "../screens/employee/IncentivesScreen";
import VisitLogScreen from "../screens/employee/VisitLogScreen";
import MoreScreen from "../screens/employee/MoreScreen";

const Tab = createBottomTabNavigator();
const ICONS = { Dashboard: "grid", "My Book": "book-open", Incentives: "trending-up", Visits: "map-pin", More: "more-horizontal" };

export default function EmployeeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <TopBar title={route.name === "Dashboard" ? "Employee Dashboard" : route.name} />,
        tabBarActiveTintColor: T.teal,
        tabBarInactiveTintColor: T.inkSoft,
        tabBarIcon: ({ color, size }) => <Feather name={ICONS[route.name]} size={size - 3} color={color} />,
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="My Book" component={MyBookScreen} />
      <Tab.Screen name="Incentives" component={IncentivesScreen} />
      <Tab.Screen name="Visits" component={VisitLogScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}
