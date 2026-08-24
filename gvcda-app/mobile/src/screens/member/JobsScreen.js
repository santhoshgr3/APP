import React, { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Chip, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

export default function JobsScreen({ navigation }) {
  const [jobs, setJobs] = useState(null);
  useFocusEffect(useCallback(() => { api.memberJobs().then(setJobs); }, []));
  if (!jobs) return <LoadingScreen />;

  return (
    <Screen>
      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Jobs Near You</Text>
      {jobs.length === 0 && <EmptyState icon="briefcase" text="No jobs posted right now." />}
      {jobs.map((j) => (
        <Card key={j.job_id} onPress={() => navigation.navigate("JobDetail", { id: j.job_id })} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{j.title}</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{j.job_type} • {j.village_name || "Multiple locations"} • {j.pay}</Text>
          {!!j.applied && <Chip>Applied</Chip>}
        </Card>
      ))}
    </Screen>
  );
}
