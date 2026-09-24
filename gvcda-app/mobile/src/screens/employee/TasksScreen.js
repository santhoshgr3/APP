import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Btn, Chip, ErrorBanner, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { fmtDate, isoDate } from "../../utils";
import { T } from "../../theme";

const PRIORITY_TONE = { high: "red", normal: "blue", low: "teal" };

// Tasks assigned by Admin: open first (overdue in red), then done.
export default function TasksScreen() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => api.employeeTasks().then((t) => { setError(""); setTasks(t); }).catch((e) => { setError(e.message); setTasks((cur) => cur || []); }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatus = async (t, status) => {
    setBusyId(t.task_id); setError("");
    try { await api.updateTaskStatus(t.task_id, status); await load(); }
    catch (e) { setError(e.message); }
    setBusyId(null);
  };

  if (!tasks) return <LoadingScreen />;

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const todayStr = isoDate(new Date());

  const renderTask = (t) => {
    const due = t.due_date ? String(t.due_date).slice(0, 10) : null;
    const overdue = t.status !== "done" && due && due < todayStr;
    return (
      <Card key={t.task_id} style={{ marginBottom: 8, borderLeftWidth: 4, borderLeftColor: overdue ? T.red : t.status === "done" ? T.green : t.status === "in_progress" ? T.blue : T.gold }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", flexShrink: 1, marginRight: 8, textDecorationLine: t.status === "done" ? "line-through" : "none" }}>{t.title}</Text>
          <Chip tone={PRIORITY_TONE[t.priority] || "blue"}>{t.priority}</Chip>
        </View>
        {t.description ? <Text style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{t.description}</Text> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
          {due ? <Text style={{ fontSize: 11, fontWeight: "700", color: overdue ? T.red : T.inkSoft }}>{overdue ? "Overdue • " : "Due "}{fmtDate(due)}</Text> : null}
          {t.assigned_by_name ? <Text style={{ fontSize: 11, color: T.inkSoft }}>From {t.assigned_by_name}</Text> : null}
          {t.status === "done" && t.completed_at ? <Text style={{ fontSize: 11, color: T.green }}>Done {fmtDate(t.completed_at)}</Text> : null}
          {t.status === "in_progress" ? <Text style={{ fontSize: 11, color: T.blue, fontWeight: "700" }}>In progress</Text> : null}
        </View>
        {t.status !== "done" && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            {t.status === "pending" && <Btn full variant="secondary" icon="play" disabled={busyId === t.task_id} onPress={() => setStatus(t, "in_progress")}>Start</Btn>}
            <Btn full icon="check" disabled={busyId === t.task_id} onPress={() => setStatus(t, "done")}>Mark done</Btn>
          </View>
        )}
      </Card>
    );
  };

  return (
    <Screen>
      <ErrorBanner message={error} />
      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Open ({open.length})</Text>
      {open.length === 0 ? <EmptyState icon="check-circle" text="No open tasks. You're all caught up." /> : open.map(renderTask)}
      <Text style={{ fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 10 }}>Done ({done.length})</Text>
      {done.length === 0 ? <EmptyState icon="inbox" text="Completed tasks will show here." /> : done.map(renderTask)}
    </Screen>
  );
}
