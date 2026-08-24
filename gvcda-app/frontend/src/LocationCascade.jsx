import React, { useEffect, useState } from "react";
import { api } from "./api";
import { inputStyle } from "./ui";

// Fully data-driven District -> Mandal -> Village picker.
// Fetches each level from the backend as the parent selection changes —
// this is the pattern to follow if you swap in the full LGD dataset later.
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
    <div style={{ display: "flex", gap: 6 }}>
      <select style={{ ...inputStyle, padding: "9px 4px", fontSize: 11.5 }}
        value={value.district_id || ""}
        onChange={(e) => onChange({ ...value, district_id: Number(e.target.value) })}>
        {districts.map((d) => <option key={d.district_id} value={d.district_id}>{d.name}</option>)}
      </select>
      <select style={{ ...inputStyle, padding: "9px 4px", fontSize: 11.5 }}
        value={value.mandal_id || ""}
        onChange={(e) => onChange({ ...value, mandal_id: Number(e.target.value) })}>
        {mandals.map((m) => <option key={m.mandal_id} value={m.mandal_id}>{m.name}</option>)}
      </select>
      <select style={{ ...inputStyle, padding: "9px 4px", fontSize: 11.5 }}
        value={value.village_id || ""}
        onChange={(e) => onChange({ ...value, village_id: Number(e.target.value) })}>
        {villages.map((v) => <option key={v.village_id} value={v.village_id}>{v.name}</option>)}
      </select>
    </div>
  );
}
