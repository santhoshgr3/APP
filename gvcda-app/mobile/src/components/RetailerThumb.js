import React from "react";
import { View, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { photoUrl } from "../api";
import { T, categoryStyle } from "../theme";

// Small square cover-photo thumbnail used anywhere a retailer shows up in a list
// (Home's nearby retailers, Sector detail). Falls back to a category-colored icon
// (see theme.js's categoryStyle) when the retailer hasn't uploaded any storefront
// photos yet, instead of a plain teal box regardless of what kind of business it is.
export default function RetailerThumb({ photo, category, size = 44 }) {
  const { color, icon } = categoryStyle(category);
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: T[`${color}Light`], overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {photo ? (
        <Image source={{ uri: photoUrl(photo) }} style={{ width: size, height: size }} />
      ) : (
        <Feather name={icon} size={size * 0.4} color={T[color]} />
      )}
    </View>
  );
}
