import { useLocation } from 'react-router';
import { LoginPage } from './LoginPage';
import { useAuth } from './context';
import { PrivateAccessPage } from '../PrivateAccessPage';

export function AccessEntryPage() {
  const { checkedAvailability, isAuthAvailable } = useAuth();
  const location = useLocation();

  if (location.hash === '#solicitud') {
    return <PrivateAccessPage />;
  }

  if (!checkedAvailability) {
    return <LoginPage />;
  }

  if (isAuthAvailable) {
    return <LoginPage />;
  }

  return <PrivateAccessPage />;
}
