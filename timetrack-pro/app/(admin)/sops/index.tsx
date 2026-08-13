import { Redirect } from 'expo-router';

// SOPs now live on the Work hub's SOPs tab. Keep old links working.
export default function SopsRedirect() {
  return <Redirect href="/(admin)/work?tab=sops" />;
}
