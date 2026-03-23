import { Suspense } from 'react';
import { ProtectedScreen } from '@/components/auth/protected-screen';
import { DashboardConsole } from '@/components/features/dashboard-console';

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <ProtectedScreen allowedRoles={['super_admin', 'consultant']} showSessionChrome={false}>
        <DashboardConsole />
      </ProtectedScreen>
    </Suspense>
  );
}
