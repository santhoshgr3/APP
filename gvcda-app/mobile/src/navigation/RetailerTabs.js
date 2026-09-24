import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { TopBar } from "../components/ui";
import { T } from "../theme";

import RetailerHomeScreen from "../screens/retailer/HomeScreen";
import OrdersInboxScreen from "../screens/retailer/OrdersInboxScreen";
import CatalogueScreen from "../screens/retailer/CatalogueScreen";
import CustomersScreen from "../screens/retailer/CustomersScreen";
import EarningsScreen from "../screens/retailer/EarningsScreen";
import ProfilePromotionsScreen from "../screens/retailer/ProfilePromotionsScreen";

const Tab = createBottomTabNavigator();
const ICONS = { Dashboard: "home", Products: "package", Orders: "inbox", Customers: "users", Earnings: "dollar-sign", Profile: "settings" };

export default function RetailerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <TopBar title={route.name === "Dashboard" ? "Retailer Dashboard" : route.name} />,
        tabBarActiveTintColor: T.teal,
        tabBarInactiveTintColor: T.inkSoft,
        tabBarIcon: ({ color, size }) => <Feather name={ICONS[route.name]} size={size - 3} color={color} />,
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Dashboard" component={RetailerHomeScreen} />
      <Tab.Screen name="Products" component={CatalogueScreen} />
      <Tab.Screen name="Orders" component={OrdersInboxScreen} />
      <Tab.Screen name="Customers" component={CustomersScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={ProfilePromotionsScreen} />
    </Tab.Navigator>
  );
}
