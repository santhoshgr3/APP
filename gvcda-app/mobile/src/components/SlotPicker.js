import React, { useMemo } from "react";
import { View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Field } from "./ui";
import { pad2, isoDate } from "../utils";
import { T } from "../theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES = [0, 15, 30, 45];

export const defaultSlot = () => ({ day: 1, hour: 10, minute: 0 });

// Builds the "YYYY-MM-DDTHH:mm" string the API expects from a { day, hour, minute } selection.
export function slotToString(slot) {
  const d = new Date();
  d.setDate(d.getDate() + slot.day);
  return `${isoDate(d)}T${pad2(slot.hour)}:${pad2(slot.minute)}`;
}

export function slotIsFuture(slot) {
  const [date, time] = slotToString(slot).split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).getTime() > Date.now();
}

const box = { borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" };

// Picker-based booking slot selector (no date-picker package is installed).
export default function SlotPicker({ value, onChange }) {
  const dayOptions = useMemo(() => {
    const out = [];
    for (let i = 0; i < 31; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      out.push([i, i === 0 ? `Today (${base})` : i === 1 ? `Tomorrow (${base})` : base]);
    }
    return out;
  }, []);
  const set = (k) => (v) => onChange({ ...value, [k]: v });

  return (
    <View>
      <Field label="Day">
        <View style={box}>
          <Picker style={{ color: T.ink }} selectedValue={value.day} onValueChange={set("day")}>
            {dayOptions.map(([v, l]) => <Picker.Item key={v} label={l} value={v} color={T.ink} />)}
          </Picker>
        </View>
      </Field>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Hour">
            <View style={box}>
              <Picker style={{ color: T.ink }} selectedValue={value.hour} onValueChange={set("hour")}>
                {Array.from({ length: 24 }, (_, h) => (
                  <Picker.Item key={h} label={`${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`} value={h} color={T.ink} />
                ))}
              </Picker>
            </View>
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Minute">
            <View style={box}>
              <Picker style={{ color: T.ink }} selectedValue={value.minute} onValueChange={set("minute")}>
                {MINUTES.map((m) => <Picker.Item key={m} label={pad2(m)} value={m} color={T.ink} />)}
              </Picker>
            </View>
          </Field>
        </View>
      </View>
    </View>
  );
}
