import { create } from 'zustand';

import type { RegistrationPolicy } from '@/shared/auth/model/auth';

type RegistrationPolicyStatus = 'idle' | 'loading' | 'ready' | 'error';

type RegistrationState = {
  policy: RegistrationPolicy;
  reset: () => void;
  setError: () => void;
  setLoading: () => void;
  setPolicy: (policy: RegistrationPolicy) => void;
  status: RegistrationPolicyStatus;
};

const fallbackPolicy: RegistrationPolicy = {
  challengeAvailable: false,
  mode: 'closed',
};

const initialState = {
  policy: fallbackPolicy,
  status: 'idle' as RegistrationPolicyStatus,
};

export const useRegistrationStore = create<RegistrationState>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setError: () => set({ policy: fallbackPolicy, status: 'error' }),
  setLoading: () => set({ status: 'loading' }),
  setPolicy: (policy) => set({ policy, status: 'ready' }),
}));
