import { Redirect } from 'expo-router';

// Task lists now live on the Work hub's Task Lists tab. Keep old links working.
export default function TaskListsRedirect() {
  return <Redirect href="/(admin)/work?tab=tasks" />;
}
