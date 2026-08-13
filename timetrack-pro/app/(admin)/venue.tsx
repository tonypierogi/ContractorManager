import { Redirect } from 'expo-router';

// Renamed: "Venue" is now "Locations". Keep old links working.
export default function VenueRedirect() {
  return <Redirect href="/(admin)/locations" />;
}
