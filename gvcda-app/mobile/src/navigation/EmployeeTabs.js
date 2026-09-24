import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { TopBar } from "../components/ui";
import { T } from "../theme";

import DashboardScreen from "../screens/employee/DashboardScreen";
import MyBookScreen from "../screens/employee/MyBookScreen";
import AttendanceScreen from "../screens/employee/AttendanceScreen";
import TasksScreen from "../screens/employee/TasksScreen";
import MoreScreen from "../screens/employee/MoreScreen";

const Tab = createBottomTabNavigator();
const ICONS = { Dashboard: "grid", Attendance: "clock", Tasks: "check-square", "My Book": "book-open", More: "more-horizontal" };

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
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="My Book" component={MyBookScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}
