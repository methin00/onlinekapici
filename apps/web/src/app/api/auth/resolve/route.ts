import { NextRequest, NextResponse } from 'next/server';
import type { PortalRole } from '@/lib/portal-types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const SUPER_ADMIN_EMAIL = 'admin@onlinekapici.com';

function isPortalRole(value: unknown): value is PortalRole {
  return (
    value === 'super_admin' ||
    value === 'consultant' ||
    value === 'manager' ||
    value === 'resident' ||
    value === 'kiosk_device'
  );
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeUnitCode(value: string) {
  return value.trim().toUpperCase();
}

function authFailure() {
  return NextResponse.json(
    { error: 'Giriş bilgileri doğrulanamadı. Bilgileri kontrol edip yeniden deneyin.' },
    { status: 401 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { identifier?: unknown; role?: unknown }
      | null;

    const rawIdentifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
    const role = body?.role;

    if (!rawIdentifier || !isPortalRole(role)) {
      return authFailure();
    }

    if (role === 'super_admin') {
      if (rawIdentifier.toLocaleLowerCase('tr-TR') !== SUPER_ADMIN_EMAIL) {
        return authFailure();
      }

      const admin = getSupabaseAdminClient();
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'super_admin')
        .maybeSingle();

      if (profileError || !profile?.id) {
        return authFailure();
      }

      const {
        data: { user },
        error: userError
      } = await admin.auth.admin.getUserById(profile.id);

      if (userError || !user?.email) {
        return authFailure();
      }

      return NextResponse.json({ email: user.email });
    }

    const admin = getSupabaseAdminClient();
    let profileId: string | null = null;

    if (role === 'consultant') {
      const { data, error } = await admin
        .from('profiles')
        .select('id, phone, login_id')
        .eq('role', 'consultant');

      if (error) {
        throw error;
      }

      const normalizedPhone = normalizePhone(rawIdentifier);
      const consultant = (data ?? []).find((profile) => {
        const phone = typeof profile.phone === 'string' ? normalizePhone(profile.phone) : '';
        const loginId = typeof profile.login_id === 'string' ? normalizePhone(profile.login_id) : '';
        return normalizedPhone.length > 0 && (phone === normalizedPhone || loginId === normalizedPhone);
      });

      profileId = consultant?.id ?? null;
    } else if (role === 'resident') {
      const normalizedUnitCode = normalizeUnitCode(rawIdentifier);
      const { data, error } = await admin
        .from('profiles')
        .select('id, role')
        .eq('login_id', normalizedUnitCode)
        .in('role', ['resident', 'manager']);

      if (error) {
        throw error;
      }

      profileId = data?.[0]?.id ?? null;
    } else if (role === 'manager') {
      const normalizedUnitCode = normalizeUnitCode(rawIdentifier);
      const { data, error } = await admin
        .from('profiles')
        .select('id')
        .eq('login_id', normalizedUnitCode)
        .eq('role', 'manager')
        .maybeSingle();

      if (error) {
        throw error;
      }

      profileId = data?.id ?? null;
    } else if (role === 'kiosk_device') {
      const { data, error } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'kiosk_device')
        .eq('login_id', rawIdentifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      profileId = data?.id ?? null;
    }

    if (!profileId) {
      return authFailure();
    }

    const {
      data: { user },
      error: userError
    } = await admin.auth.admin.getUserById(profileId);

    if (userError || !user?.email) {
      return authFailure();
    }

    return NextResponse.json({ email: user.email });
  } catch {
    return authFailure();
  }
}
