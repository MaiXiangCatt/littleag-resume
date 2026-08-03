import { useRef } from 'react';

import { useInvitationChallenge } from '@/pages/home/hooks/useInvitationChallenge';
import { PrivacySettingsButton } from '@/shared/analytics/ui/PrivacySettingsButton';
import type { RegistrationPolicy } from '@/shared/auth/model/auth';
import { Button } from '@/shared/ui/button';

import { InvitationChallengeDialog } from './InvitationChallengeDialog';

type FooterProps = {
  onRegister: () => void;
  registrationPolicy: RegistrationPolicy;
};

export function Footer({ onRegister, registrationPolicy }: FooterProps) {
  const challengeState = useInvitationChallenge();
  const clickCountRef = useRef(0);
  const lastClickAtRef = useRef(0);

  function handleAgClick() {
    const now = Date.now();
    if (now - lastClickAtRef.current > 1_500) {
      clickCountRef.current = 0;
    }
    lastClickAtRef.current = now;
    clickCountRef.current += 1;
    if (clickCountRef.current < 9) {
      return;
    }
    clickCountRef.current = 0;
    lastClickAtRef.current = 0;
    void challengeState.reveal(registrationPolicy);
  }

  return (
    <>
      <footer
        className="border-t border-[#5c251d] bg-[#2f1714] px-4 py-8 text-sm text-[#f5ded9]"
        role="contentinfo"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">
            Little
            <Button
              aria-label="Ag"
              className="h-auto min-w-0 rounded-none px-0 py-0 font-semibold text-inherit hover:bg-transparent hover:text-inherit"
              onClick={handleAgClick}
              type="button"
              variant="ghost"
            >
              Ag
            </Button>
            Resume
          </p>
          <div className="flex items-center gap-3">
            <PrivacySettingsButton
              className="h-8 border-[#79524c] bg-transparent px-3 text-xs text-[#f5ded9] hover:bg-[#4b2924] hover:text-white"
              size="sm"
              variant="outline"
            />
            <p>一个用爱发电的开源项目</p>
          </div>
        </div>
      </footer>
      <InvitationChallengeDialog challengeState={challengeState} onRegister={onRegister} />
    </>
  );
}
