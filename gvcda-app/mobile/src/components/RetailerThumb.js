import React from "react";
import { View, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { photoUrl } from "../api";
import { T } from "../theme";

// Small square cover-photo thumbnail used anywhere a retailer shows up in a list
// (Home's nearby retailers, Sector detail). Falls back to a store icon when the
// retailer hasn't uploaded any storefront photos yet.
export default function RetailerThumb({ photo, size = 44 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: T.tealLight, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {photo ? (
        <Image source={{ uri: photoUrl(photo) }} style={{ width: size, height: size }} />
      ) : (
        <Feather name="shopping-bag" size={size * 0.4} color={T.teal} />
      )}
    </View>
  );
}
