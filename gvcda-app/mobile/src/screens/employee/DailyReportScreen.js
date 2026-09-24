import React from "react";
import { View } from "react-native";
import { TopBar } from "../../components/ui";
import VisitLogScreen from "./VisitLogScreen";
import { T } from "../../theme";

// Daily Work Report = the existing visit log, reachable from the Employee "More" menu.
export default function DailyReportScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Daily Work Report" subtitle="Log your field visits" onBack={() => navigation.goBack()} />
      <VisitLogScreen />
    </View>
  );
}
