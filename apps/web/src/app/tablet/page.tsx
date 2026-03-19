import { ProtectedScreen } from '@/components/auth/protected-screen';
import { TabletConsole } from '@/components/features/tablet-console';

export default function TabletPage() {
  return (
    <ProtectedScreen allowedRoles={['kiosk_device']}>
      <TabletConsole />
    </ProtectedScreen>
  );
}
