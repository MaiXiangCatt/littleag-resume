import { useState } from 'react';

import { authService } from '@/shared/auth/api/auth.service';
import { authErrorMessage } from '@/shared/auth/model/auth';
import type {
  InvitationChallenge,
  InvitationCode,
  RegistrationPolicy,
} from '@/shared/auth/model/auth';

type InvitationChallengeStatus = 'idle' | 'loading' | 'question' | 'success' | 'closed' | 'error';

export type InvitationChallengeController = {
  answer: (value: string) => Promise<void>;
  challenge: InvitationChallenge | null;
  changeOpen: (open: boolean) => void;
  error?: string;
  invitation: InvitationCode | null;
  open: boolean;
  reveal: (policy: RegistrationPolicy) => Promise<void>;
  status: InvitationChallengeStatus;
};

export function useInvitationChallenge(): InvitationChallengeController {
  const [challenge, setChallenge] = useState<InvitationChallenge | null>(null);
  const [error, setError] = useState<string>();
  const [invitation, setInvitation] = useState<InvitationCode | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<InvitationChallengeStatus>('idle');

  async function reveal(policy: RegistrationPolicy) {
    setChallenge(null);
    setError(undefined);
    setInvitation(null);
    setOpen(true);

    if (policy.mode === 'closed' || !policy.challengeAvailable) {
      setStatus('closed');
      return;
    }

    setStatus('loading');
    try {
      setChallenge(await authService.getInvitationChallenge());
      setStatus('question');
    } catch (requestError) {
      setError(authErrorMessage(requestError));
      setStatus('error');
    }
  }

  async function answer(value: string) {
    if (!challenge || status !== 'question') {
      return;
    }
    setError(undefined);
    setStatus('loading');
    try {
      setInvitation(await authService.answerInvitationChallenge(challenge.challengeId, value));
      setStatus('success');
    } catch (requestError) {
      setError(authErrorMessage(requestError));
      setStatus('question');
    }
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setChallenge(null);
      setError(undefined);
      setInvitation(null);
      setStatus('idle');
    }
  }

  return {
    answer,
    challenge,
    changeOpen,
    error,
    invitation,
    open,
    reveal,
    status,
  };
}
