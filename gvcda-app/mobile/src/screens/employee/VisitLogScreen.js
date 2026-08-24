import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import { Screen, Card, Btn, Field, Input, ErrorBanner, EmptyState } from "../../components/ui";
import LocationCascade from "../../components/LocationCascade";
import { api } from "../../api";
import { T } from "../../theme";

const PURPOSES = [
  ["enrolment", "Enrolment"],
  ["retailer", "Retailer"],
  ["follow_up", "Follow-up"],
  ["complaint", "Complaint"],
];

// Screen Spec 2.6 — lightweight accountability tool. GPS is optional (falls back to
// manual village select if permission is denied, per the spec's stated state).
export default function VisitLogScreen() {
  const [visits, setVisits] = useState(null);
  const [purpose, setPurpose] = useState("enrolment");
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [coords, setCoords] = useState(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.employeeVisits().then(setVisits);
  useFocusEffect(useCallback(() => { load(); }, []));

  const checkIn = async () => {
    setError(""); setSaving(true);
    try {
      let lat = null, lng = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude; lng = pos.coords.longitude;
        setCoords({ lat, lng });
      } else {
        setGpsDenied(true);
      }
      if (!lat && !loc.village_id) {
        setError("GPS is unavailable — select a village manually below.");
        setSaving(false);
        return;
      }
      await api.logVisit({ village_id: loc.village_id, purpose, notes, lat, lng });
      setNotes("");
      await load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Screen>
      <Card style={{ marginBottom: 16 }}>
        <ErrorBanner message={error} />
        <Field label="Purpose">
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
            <Picker selectedValue={purpose} onValueChange={setPurpose}>
              {PURPOSES.map(([v, l]) => <Picker.Item key={v} label={l} value={v} />)}
            </Picker>
          </View>
        </Field>
        {gpsDenied && (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>GPS permission denied — select village manually:</Text>
            <LocationCascade value={loc} onChange={setLoc} />
          </View>
        )}
        <Field label="Notes">
          <Input value={notes} onChangeText={setNotes} placeholder="What did you do on this visit?" />
        </Field>
        <Btn full icon="map-pin" disabled={saving} onPress={checkIn}>{saving ? "Checking in..." : "Check In"}</Btn>
      </Card>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Visit History</Text>
      {visits === null ? null : visits.length === 0 ? <EmptyState icon="map" text="No visits logged yet." /> : (
        visits.map((v) => (
          <Card key={v.visit_id} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", textTransform: "capitalize" }}>{v.purpose.replace("_", " ")}</Text>
            <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
              {v.village_name || (v.lat ? `GPS ${v.lat.toFixed(3)}, ${v.lng.toFixed(3)}` : "No location")} • {new Date(v.created_at).toLocaleString()}
            </Text>
            {v.notes ? <Text style={{ fontSize: 11.5, color: T.ink, marginTop: 4 }}>{v.notes}</Text> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
