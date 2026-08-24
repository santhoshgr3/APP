import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../api";
import { TopBar, LoadingScreen, ErrorBanner, Screen, Btn } from "../components/ui";
import BankTransferQR from "../components/BankTransferQR";
import { T } from "../theme";

// Screen Spec 1.5. There's no payment gateway account yet, so this is direct
// bank/UPI transfer via a QR code — see BankTransferQR for the shared flow with
// retailer commission settlement.
export default function PaymentScreen({ navigation, route }) {
  const { plan } = route.params;
  const [checkout, setCheckout] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    api.membershipCheckout(plan.plan_id).then(setCheckout).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: T.cream }}>
        <TopBar title="Payment" onBack={() => navigation.goBack()} />
        <Screen>
          <ErrorBanner message={error} />
          <Btn full onPress={() => navigation.goBack()}>Back to plan selection</Btn>
        </Screen>
      </View>
    );
  }
  if (checkout === undefined) return <LoadingScreen />;

  return (
    <BankTransferQR
      title={`Pay ₹${checkout.amount}`}
      subtitle={checkout.plan.name + " Membership"}
      checkout={checkout}
      onSubmitUtr={api.submitMembershipUtr}
      onBack={() => navigation.goBack()}
      onDone={() => navigation.replace("Main")}
    />
  );
}
