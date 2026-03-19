import type { PortalRole } from '@/lib/portal-types';
import { ProtectedScreen } from '@/components/auth/protected-screen';
import { ResidentConsole } from '@/components/features/resident-console';

const RESIDENT_ALLOWED_ROLES: PortalRole[] = ['resident', 'manager'];

export default function ResidentPage() {
  return (
    <ProtectedScreen allowedRoles={RESIDENT_ALLOWED_ROLES} showSessionChrome={false}>
      <ResidentConsole />
    </ProtectedScreen>
  );
}
