import { Suspense } from 'react';
import { AuthConsole } from '@/components/features/auth-console';

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthConsole />
    </Suspense>
  );
}
