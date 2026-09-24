import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, Chip, Field, Input, ErrorBanner, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { fmtDate, fmtTime, isValidIsoDate, isoDate, pad2 } from "../../utils";
import { T } from "../../theme";

const LEAVE_TYPES = [["casual", "Casual"], ["sick", "Sick"], ["earned", "Earned"], ["unpaid", "Unpaid"]];
const LEAVE_TONE = { pending: "gold", approved: "green", rejected: "red" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }

// Attendance: GPS check-in/out, month log + summary, and leave requests.
export default function AttendanceScreen() {
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [att, setAtt] = useState(null);
  const [leaves, setLeaves] = useState(null);
  const [error, setError] = useState("");
  const [punching, setPunching] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [leaveType, setLeaveType] = useState("casual");
  const [fromDate, setFromDate] = useState(isoDate(new Date()));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [reason, setReason] = useState("");
  const [leaveError, setLeaveError] = useState("");
  const [sendingLeave, setSendingLeave] = useState(false);

  const load = useCallback(() => {
    const fail = (e) => setError(e.message);
    api.employeeAttendance(monthKey(monthDate)).then((r) => { setError(""); setAtt(r); }).catch(fail);
    api.employeeLeaves().then(setLeaves).catch(fail);
  }, [monthDate]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shiftMonth = (delta) => {
    setAtt(null);
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const getCoords = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return {};
      const pos = await Location.getCurrentPositionAsync({});
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (e) { return {}; }
  };

  const today = att?.today;
  const checkedIn = !!today?.check_in_at;
  const checkedOut = !!today?.check_out_at;

  const punch = async () => {
    setPunching(true); setError("");
    try {
      const coords = await getCoords();
      if (!checkedIn) await api.attendanceCheckIn(coords);
      else await api.attendanceCheckOut(coords);
      load();
    } catch (e) { setError(e.message); }
    setPunching(false);
  };

  const submitLeave = async () => {
    if (!isValidIsoDate(fromDate) || !isValidIsoDate(toDate)) { setLeaveError("Enter dates as YYYY-MM-DD"); return; }
    if (toDate < fromDate) { setLeaveError("End date can't be before the start date"); return; }
    setSendingLeave(true); setLeaveError("");
    try {
      await api.requestLeave({ from_date: fromDate, to_date: toDate, leave_type: leaveType, reason: reason.trim() || undefined });
      setReason(""); setShowLeave(false);
      load();
    } catch (e) { setLeaveError(e.message); }
    setSendingLeave(false);
  };

  const withdraw = (l) => {
    Alert.alert("Withdraw leave request?", `${fmtDate(l.from_date)} to ${fmtDate(l.to_date)}`, [
      { text: "No", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: async () => {
        try { await api.withdrawLeave(l.leave_id); load(); }
        catch (e) { setError(e.message); }
      } },
    ]);
  };

  if (!att || !leaves) {
    return error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />;
  }

  const btnColor = !checkedIn ? T.teal : !checkedOut ? T.terracotta : T.line;

  return (
    <Screen>
      <ErrorBanner message={error} />

      <Card style={{ alignItems: "center", paddingVertical: 20, marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 12 }}>TODAY • {fmtDate(isoDate(new Date()))}</Text>
        <TouchableOpacity
          disabled={punching || checkedOut}
          onPress={punch}
          activeOpacity={0.8}
          style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: btnColor, alignItems: "center", justifyContent: "center", opacity: punching ? 0.6 : 1 }}
        >
          <Feather name={checkedOut ? "check" : checkedIn ? "log-out" : "log-in"} size={30} color={checkedOut ? T.inkSoft : "#fff"} />
          <Text style={{ color: checkedOut ? T.inkSoft : "#fff", fontWeight: "800", fontSize: 13, marginTop: 6 }}>
            {punching ? "Please wait..." : checkedOut ? "Done for today" : checkedIn ? "Check out" : "Check in"}
          </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 24, marginTop: 16 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 10, color: T.inkSoft, fontWeight: "700" }}>IN</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: T.green }}>{checkedIn ? fmtTime(today.check_in_at) : "--"}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 10, color: T.inkSoft, fontWeight: "700" }}>OUT</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: T.terracotta }}>{checkedOut ? fmtTime(today.check_out_at) : "--"}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 10, textAlign: "center" }}>Your location is attached when location permission is allowed.</Text>
      </Card>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={arrow}><Feather name="chevron-left" size={16} color={T.ink} /></TouchableOpacity>
        <Text style={{ fontSize: 13, fontWeight: "700" }}>{MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={arrow}><Feather name="chevron-right" size={16} color={T.ink} /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: T.green }}>{att.summary?.days_present ?? 0}</Text>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "600" }}>Days present</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: T.blue }}>{att.summary?.approved_leave_days ?? 0}</Text>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "600" }}>Approved leave days</Text>
        </Card>
      </View>
      {att.records.length === 0 ? <EmptyState icon="calendar" text="No attendance recorded this month." /> : att.records.map((r) => (
        <Card key={r.attendance_id} style={{ marginBottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{fmtDate(r.work_date)}</Text>
          <Text style={{ fontSize: 11.5, color: T.inkSoft }}>{fmtTime(r.check_in_at)} - {r.check_out_at ? fmtTime(r.check_out_at) : "still in"}</Text>
        </Card>
      ))}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700" }}>Leave</Text>
        <Btn variant="ghost" icon={showLeave ? "x" : "plus"} onPress={() => { setShowLeave((s) => !s); setLeaveError(""); }}>{showLeave ? "Cancel" : "Request leave"}</Btn>
      </View>
      {showLeave && (
        <Card style={{ marginBottom: 12 }}>
          <ErrorBanner message={leaveError} />
          <Field label="Leave type">
            <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
              <Picker style={{ color: T.ink }} selectedValue={leaveType} onValueChange={setLeaveType}>
                {LEAVE_TYPES.map(([v, l]) => <Picker.Item key={v} label={l} value={v} color={T.ink} />)}
              </Picker>
            </View>
          </Field>
          <Field label="From (YYYY-MM-DD)"><Input value={fromDate} onChangeText={setFromDate} placeholder="2026-09-30" keyboardType="numbers-and-punctuation" maxLength={10} /></Field>
          <Field label="To (YYYY-MM-DD)"><Input value={toDate} onChangeText={setToDate} placeholder="2026-09-30" keyboardType="numbers-and-punctuation" maxLength={10} /></Field>
          <Field label="Reason (optional)"><Input value={reason} onChangeText={setReason} placeholder="Why do you need leave?" multiline /></Field>
          <Btn full onPress={submitLeave} disabled={sendingLeave}>{sendingLeave ? "Sending..." : "Submit Request"}</Btn>
        </Card>
      )}
      {leaves.length === 0 ? <EmptyState icon="briefcase" text="No leave requests yet." /> : leaves.map((l) => (
        <Card key={l.leave_id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", textTransform: "capitalize" }}>{l.leave_type} leave</Text>
            <Chip tone={LEAVE_TONE[l.status] || "gold"}>{l.status}</Chip>
          </View>
          <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{fmtDate(l.from_date)} to {fmtDate(l.to_date)}</Text>
          {l.reason ? <Text style={{ fontSize: 12, marginTop: 4 }}>{l.reason}</Text> : null}
          {l.decision_note ? <Text style={{ fontSize: 11.5, color: T.teal, marginTop: 4 }}>Admin note: {l.decision_note}</Text> : null}
          {l.status === "pending" && <Btn variant="danger" style={{ marginTop: 8 }} onPress={() => withdraw(l)}>Withdraw</Btn>}
        </Card>
      ))}
    </Screen>
  );
}

const arrow = { borderWidth: 1, borderColor: T.line, backgroundColor: "#fff", borderRadius: 8, width: 32, height: 32, alignItems: "center", justifyContent: "center" };
