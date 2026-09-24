import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import LoginScreen from "../screens/LoginScreen";
import RegistrationScreen from "../screens/RegistrationScreen";
import PlanSelectScreen from "../screens/PlanSelectScreen";
import PaymentScreen from "../screens/PaymentScreen";
import MainScreen from "./MainScreen";

import SectorDetailScreen from "../screens/member/SectorDetailScreen";
import RetailerProfileScreen from "../screens/member/RetailerProfileScreen";
import CartScreen from "../screens/member/CartScreen";
import OrderTrackingScreen from "../screens/member/OrderTrackingScreen";
import JobDetailScreen from "../screens/member/JobDetailScreen";
import ComplaintScreen from "../screens/member/ComplaintScreen";
import DigitalCardScreen from "../screens/member/DigitalCardScreen";
import TransactionsScreen from "../screens/member/TransactionsScreen";

import EnrolMemberScreen from "../screens/employee/EnrolMemberScreen";
import ListRetailerScreen from "../screens/employee/ListRetailerScreen";
import IdCardScreen from "../screens/employee/IdCardScreen";
import PayScreen from "../screens/employee/PayScreen";
import DailyReportScreen from "../screens/employee/DailyReportScreen";

import RetailerRegisterScreen from "../screens/retailer/RetailerRegisterScreen";
import PendingApprovalScreen from "../screens/retailer/PendingApprovalScreen";
import OrderDetailScreen from "../screens/retailer/OrderDetailScreen";
import CustomerDetailScreen from "../screens/retailer/CustomerDetailScreen";
import SupportScreen from "../screens/SupportScreen";

const Stack = createNativeStackNavigator();

// One flat stack holds every screen. Bottom tabs (Main) live inside it as a single
// stack screen; drill-down screens (SectorDetail, Cart, OrderDetail, ...) sit
// alongside it and push on top from wherever they're triggered — React Navigation
// bubbles navigate() calls up from a nested tab screen to this parent stack.
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Registration" component={RegistrationScreen} />
      <Stack.Screen name="PlanSelect" component={PlanSelectScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="RetailerRegister" component={RetailerRegisterScreen} />
      <Stack.Screen name="RetailerPending" component={PendingApprovalScreen} />
      <Stack.Screen name="Main" component={MainScreen} />

      {/* Member drill-downs */}
      <Stack.Screen name="SectorDetail" component={SectorDetailScreen} />
      <Stack.Screen name="RetailerProfile" component={RetailerProfileScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="Complaint" component={ComplaintScreen} />
      <Stack.Screen name="DigitalCard" component={DigitalCardScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />

      {/* Employee drill-downs */}
      <Stack.Screen name="EnrolMember" component={EnrolMemberScreen} />
      <Stack.Screen name="ListRetailer" component={ListRetailerScreen} />
      <Stack.Screen name="IdCard" component={IdCardScreen} />
      <Stack.Screen name="Pay" component={PayScreen} />
      <Stack.Screen name="DailyReport" component={DailyReportScreen} />

      {/* Retailer drill-downs */}
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />

      {/* Shared by Retailer and Employee */}
      <Stack.Screen name="Support" component={SupportScreen} />
    </Stack.Navigator>
  );
}
