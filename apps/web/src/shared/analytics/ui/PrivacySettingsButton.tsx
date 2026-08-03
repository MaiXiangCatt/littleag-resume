import { ShieldCheck } from 'lucide-react';
import type { ComponentProps } from 'react';

import { useAnalyticsStore } from '../store/analytics.store';
import { Button } from '@/shared/ui/button';

export function PrivacySettingsButton({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'onClick'>) {
  const enabled = useAnalyticsStore((state) => state.enabled);
  const openSettings = useAnalyticsStore((state) => state.openSettings);
  const storageAvailable = useAnalyticsStore((state) => state.storageAvailable);

  if (!enabled || !storageAvailable) return null;

  return (
    <Button className={className} onClick={openSettings} type="button" {...props}>
      <ShieldCheck aria-hidden="true" size={16} />
      隐私设置
    </Button>
  );
}
