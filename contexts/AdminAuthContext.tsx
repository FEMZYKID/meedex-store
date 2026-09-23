'use client';

import { createContext, useContext } from 'react';
import type { CurrentUser } from '../types';

export const AdminAuthContext = createContext<CurrentUser | null>(null);

// Every admin sub-route calls this instead of re-checking auth itself.
// Throws if used outside the admin layout, which should never happen in
// practice since the layout is what renders every admin page.
export function useAdminAuth(): CurrentUser {
  const user = useContext(AdminAuthContext);
  if (!user) {
    throw new Error('useAdminAuth must be used within the admin layout.');
  }
  return user;
}