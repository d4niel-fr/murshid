import { Redirect } from 'expo-router';
import { useSession } from '@/state/session';

export default function Index() {
  const { nextRoute } = useSession();
  return <Redirect href={nextRoute} />;
}
