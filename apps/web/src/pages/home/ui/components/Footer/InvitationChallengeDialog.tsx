import type { FormEvent } from 'react';
import { useState } from 'react';
import { Check, Copy, KeyRound, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { InvitationChallengeController } from '@/pages/home/hooks/useInvitationChallenge';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Form } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

type InvitationChallengeDialogProps = {
  challengeState: InvitationChallengeController;
  onRegister: () => void;
};

export function InvitationChallengeDialog({
  challengeState,
  onRegister,
}: InvitationChallengeDialogProps) {
  const [answer, setAnswer] = useState('');

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await challengeState.answer(answer);
  }

  async function copyInvitationCode() {
    if (!challengeState.invitation) {
      return;
    }
    try {
      await navigator.clipboard.writeText(challengeState.invitation.invitationCode);
      toast.success('邀请码已复制');
    } catch {
      toast.error('复制失败，请手动选择邀请码');
    }
  }

  function changeOpen(open: boolean) {
    if (!open) {
      setAnswer('');
    }
    challengeState.changeOpen(open);
  }

  return (
    <Dialog onOpenChange={changeOpen} open={challengeState.open}>
      <DialogContent className="overflow-hidden border-[#d8c6b5] bg-[#fffaf4] sm:max-w-md">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#80534b] via-[#c5a46d] to-[#80534b]"
        />
        <DialogTitle className="flex items-center gap-2 font-serif text-xl text-[#3d2926]">
          <Sparkles aria-hidden="true" className="text-[#a47643]" size={18} />
          获取邀请码
        </DialogTitle>
        <DialogDescription>{challengeDescription(challengeState.status)}</DialogDescription>

        {challengeState.status === 'loading' ? (
          <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">
            正在出题……
          </div>
        ) : null}

        {challengeState.status === 'closed' ? (
          <Alert>
            <AlertDescription>注册暂未开放，已有账号和本地模式仍可正常使用。</AlertDescription>
          </Alert>
        ) : null}

        {challengeState.status === 'error' ? (
          <Alert>
            <AlertDescription>{challengeState.error ?? '出错了，请稍后再试。'}</AlertDescription>
          </Alert>
        ) : null}

        {challengeState.status === 'question' && challengeState.challenge ? (
          <Form className="space-y-4" onSubmit={submitAnswer}>
            <div className="rounded-xl border border-[#dfd0c0] bg-white/75 p-4">
              <p className="font-serif text-lg leading-8 text-[#432e2b]">
                {challengeState.challenge.prompt}
                <span className="ml-1 inline-block min-w-24 border-b border-[#9a7664]">&nbsp;</span>
              </p>
            </div>
            <div className="space-y-2">
              <Input
                autoComplete="off"
                autoFocus
                id="invitation-answer"
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="请输入你的答案"
                value={answer}
              />
              {challengeState.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {challengeState.error}
                </p>
              ) : null}
            </div>
            <Button className="w-full" disabled={!answer.trim()} type="submit">
              提交答案
            </Button>
          </Form>
        ) : null}

        {challengeState.status === 'success' && challengeState.invitation ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#d8c6b5] bg-white/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#4f3935]">
                <Check aria-hidden="true" className="text-emerald-600" size={17} />
                获取成功～
              </div>
              <Label htmlFor="issued-invitation-code">一次性邀请码</Label>
              <Input
                className="mt-2 select-all font-mono tracking-wide"
                id="issued-invitation-code"
                readOnly
                value={challengeState.invitation.invitationCode}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {Math.ceil(challengeState.invitation.expiresInSeconds / 60)}{' '}
                分钟内有效，注册成功后立即失效。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={copyInvitationCode} type="button" variant="outline">
                <Copy aria-hidden="true" size={16} />
                复制邀请码
              </Button>
              <Button
                onClick={() => {
                  changeOpen(false);
                  onRegister();
                }}
                type="button"
              >
                <KeyRound aria-hidden="true" size={16} />
                去注册
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function challengeDescription(status: InvitationChallengeController['status']): string {
  if (status === 'success') {
    return '这枚邀请码只会出现一次，记得先复制好。';
  }
  if (status === 'closed') {
    return '由于未知原因，注册暂未开放。';
  }
  return '答对了才有邀请码哦～';
}
