'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { EffectiveAccess, Permission } from '@/lib/permissions';

/**
 * The caller's effective permissions and block scope, fetched once.
 *
 * This is what makes the dashboard scope-aware rather than a fixed menu that
 * 403s when clicked. Every nav entry, action button and page guard reads from
 * here, so what a person SEES matches what the server will actually let them
 * do — the same discipline the staff app uses for role-specific screens.
 *
 * The server remains the authority: hiding a control is a usability decision,
 * and the corresponding route enforces the same permission regardless.
 */
type AccessContextValue = {
  access: EffectiveAccess | null;
  isLoading: boolean;
  /** True if the caller holds every listed permission. Super admin always true. */
  can: (...permissions: Permission[]) => boolean;
  /** True when the caller is limited to specific blocks. */
  isBlockScoped: boolean;
  blocks: string[];
};

const AccessContext = createContext<AccessContextValue>({
  access: null,
  isLoading: true,
  can: () => false,
  isBlockScoped: false,
  blocks: [],
});

export function AccessProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<EffectiveAccess>({
    queryKey: ['admin', 'me', 'access'],
    queryFn: () => api.get<EffectiveAccess>('/admin/me/access'),
    // Permissions change rarely, but revocation must land promptly — a minute
    // is a reasonable ceiling on "still sees a button they just lost".
    staleTime: 60_000,
    retry: 1,
  });

  const value = useMemo<AccessContextValue>(() => {
    const access = data ?? null;
    const held = new Set<string>(access?.permissions ?? []);
    return {
      access,
      isLoading,
      can: (...permissions: Permission[]) => {
        if (!access) return false;
        if (access.isSuperAdmin) return true;
        return permissions.every((p) => held.has(p));
      },
      isBlockScoped: (access?.blocks?.length ?? 0) > 0,
      blocks: access?.blocks ?? [],
    };
  }, [data, isLoading]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}

/**
 * Render children only when the caller holds the permission(s).
 *
 * Prefer this over scattering `can()` checks: it keeps the permission next to
 * the thing it protects, so reading the JSX tells you who can see what.
 */
export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission | Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, isLoading } = useAccess();
  if (isLoading) return null;
  const list = Array.isArray(permission) ? permission : [permission];
  return can(...list) ? <>{children}</> : <>{fallback}</>;
}
