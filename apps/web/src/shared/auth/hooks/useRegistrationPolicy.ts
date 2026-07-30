import { useEffect } from 'react';

import { authService } from '@/shared/auth/api/auth.service';
import { useRegistrationStore } from '@/shared/auth/store/registration.store';

let registrationPolicyPromise: Promise<void> | null = null;

export function useRegistrationPolicy() {
  const policy = useRegistrationStore((state) => state.policy);
  const status = useRegistrationStore((state) => state.status);

  useEffect(() => {
    if (status !== 'idle') {
      return;
    }
    const store = useRegistrationStore.getState();
    store.setLoading();
    registrationPolicyPromise ??= authService
      .getRegistrationPolicy()
      .then((nextPolicy) => useRegistrationStore.getState().setPolicy(nextPolicy))
      .catch(() => useRegistrationStore.getState().setError())
      .finally(() => {
        registrationPolicyPromise = null;
      });
  }, [status]);

  return { policy, status };
}
