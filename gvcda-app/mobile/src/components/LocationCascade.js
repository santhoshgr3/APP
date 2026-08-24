import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { api } from "../api";
import { T } from "../theme";

// District -> Mandal -> Village cascading picker, fully data-driven from the backend.
// Mirrors the web app's LocationCascade.jsx so both clients enforce the same hierarchy.
export default function LocationCascade({ value, onChange }) {
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);

  useEffect(() => { api.districts().then(setDistricts); }, []);

  useEffect(() => {
    if (!value.district_id) return;
    api.mandals(value.district_id).then((m) => {
      setMandals(m);
      if (!m.find((x) => x.mandal_id === value.mandal_id)) {
        onChange({ ...value, mandal_id: m[0]?.mandal_id, village_id: null });
      }
    });
  }, [value.district_id]);

  useEffect(() => {
    if (!value.mandal_id) return;
    api.villages(value.mandal_id).then((v) => {
      setVillages(v);
      if (!v.find((x) => x.village_id === value.village_id)) {
        onChange({ ...value, village_id: v[0]?.village_id });
      }
    });
  }, [value.mandal_id]);

  return (
    <View>
      <Text style={styles.label}>District</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value.district_id ?? ""} onValueChange={(v) => onChange({ ...value, district_id: v })}>
          <Picker.Item label="Select district" value="" />
          {districts.map((d) => <Picker.Item key={d.district_id} label={d.name} value={d.district_id} />)}
        </Picker>
      </View>
      <Text style={styles.label}>Mandal</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value.mandal_id ?? ""} enabled={!!value.district_id} onValueChange={(v) => onChange({ ...value, mandal_id: v })}>
          <Picker.Item label="Select mandal" value="" />
          {mandals.map((m) => <Picker.Item key={m.mandal_id} label={m.name} value={m.mandal_id} />)}
        </Picker>
      </View>
      <Text style={styles.label}>Village / Town</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value.village_id ?? ""} enabled={!!value.mandal_id} onValueChange={(v) => onChange({ ...value, village_id: v })}>
          <Picker.Item label="Select village/town" value="" />
          {villages.map((v) => <Picker.Item key={v.village_id} label={v.name} value={v.village_id} />)}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 4, marginTop: 8 },
  pickerWrap: { borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff", overflow: "hidden" },
});
