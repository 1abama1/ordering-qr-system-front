import { create } from 'zustand';
import type { AuthSession } from '../../shared/api/contracts';
export const useAuth = create<{
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  logout: () => void;
}>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  logout: () => set({ session: null }),
}));
