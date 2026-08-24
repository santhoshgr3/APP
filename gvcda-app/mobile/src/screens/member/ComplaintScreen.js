import React, { useState } from "react";
import { View, Text } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Field, Input, Btn } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 1.10 — raise a complaint / service request.
export default function ComplaintScreen({ navigation }) {
  const [category, setCategory] = useState("Order Issue");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Raise a complaint" onBack={() => navigation.goBack()} />
      <Screen>
        {sent ? (
          <View style={{ alignItems: "center", paddingTop: 50 }}>
            <Feather name="check-circle" size={32} color={T.teal} />
            <Text style={{ fontWeight: "700", marginTop: 10 }}>Complaint submitted</Text>
            <Btn full onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>Back to Profile</Btn>
          </View>
        ) : (
          <>
            <Field label="Category">
              <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
                <Picker selectedValue={category} onValueChange={setCategory}>
                  <Picker.Item label="Order Issue" value="Order Issue" />
                  <Picker.Item label="Retailer Issue" value="Retailer Issue" />
                  <Picker.Item label="Membership Issue" value="Membership Issue" />
                  <Picker.Item label="App Issue" value="App Issue" />
                </Picker>
              </View>
            </Field>
            <Field label="Describe the issue">
              <Input value={description} onChangeText={setDescription} placeholder="What happened?" multiline numberOfLines={4} style={{ height: 90, textAlignVertical: "top" }} />
            </Field>
            <Btn full icon="send" disabled={!description} onPress={async () => { await api.raiseComplaint(category, description); setSent(true); }}>
              Submit
            </Btn>
          </>
        )}
      </Screen>
    </View>
  );
}
