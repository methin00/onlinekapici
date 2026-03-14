import { ProtectedScreen } from '@/components/auth/protected-screen';
import { ResidentConsole } from '@/components/features/resident-console';

export default function ResidentPage() {
  return (
    <ProtectedScreen allowedRoles={['resident']}>
      <ResidentConsole />
    </ProtectedScreen>
  );
}
