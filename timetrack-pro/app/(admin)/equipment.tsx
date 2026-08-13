import { Redirect } from 'expo-router';

// Merged: Equipment now lives inside Locations & Equipment. Keep old links working.
export default function EquipmentRedirect() {
  return <Redirect href="/(admin)/locations" />;
}
