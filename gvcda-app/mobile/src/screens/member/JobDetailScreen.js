import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { TopBar, Screen, Card, Btn, LoadingScreen } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

export default function JobDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [jobs, setJobs] = useState(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => { api.memberJobs().then(setJobs); }, []);

  if (!jobs) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Loading" onBack={() => navigation.goBack()} />
      <LoadingScreen />
    </View>
  );

  const j = jobs.find((x) => x.job_id === id);
  const isApplied = applied || !!j.applied;

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={j.title} onBack={() => navigation.goBack()} />
      <Screen>
        <Card>
          <Text style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 6 }}>{j.job_type} • {j.village_name || "Multiple locations"}</Text>
          <Text style={{ fontSize: 15, fontWeight: "800", color: T.teal }}>{j.pay}</Text>
          {j.description ? <Text style={{ fontSize: 12.5, color: T.ink, marginTop: 10 }}>{j.description}</Text> : null}
        </Card>
        <Btn full style={{ marginTop: 16 }} disabled={isApplied} icon={isApplied ? "check-circle" : undefined}
          onPress={async () => { await api.applyJob(id); setApplied(true); }}>
          {isApplied ? "Applied" : "Apply Now"}
        </Btn>
      </Screen>
    </View>
  );
}
