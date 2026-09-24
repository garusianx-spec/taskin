'use client';

import { useEffect, useState } from 'react';
import type { Workspace } from '@/types';
import { Button, Checkbox, Input, Modal } from '@/components/ui';
import { WarningIcon } from '@/components/icons';

export interface DeleteWorkspaceModalProps {
  readonly workspace: Workspace | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

/**
 * Irreversible workspace deletion. The button stays disabled until the Owner types the
 * workspace's exact name and acknowledges the consequence — two deliberate acts, so it can
 * never happen from a stray click or a reflexive Enter. The overlay does not dismiss it.
 */
export function DeleteWorkspaceModal({ workspace, onClose, onConfirm }: DeleteWorkspaceModalProps) {
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setTyped('');
    setAcknowledged(false);
  }, [workspace]);

  const matches = workspace !== null && typed.trim() === workspace.name;

  return (
    <Modal
      open={workspace !== null}
      onClose={onClose}
      size="sm"
      dismissOnOverlayClick={false}
      title="حذف دائمی فضای کاری"
      description={
        workspace ? `«${workspace.name}» و همه داده‌های آن حذف می‌شود. این کار بازگشت‌پذیر نیست.` : undefined
      }
      icon={<WarningIcon size={20} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="destructive" disabled={!matches || !acknowledged} onClick={onConfirm}>
            حذف دائمی
          </Button>
        </>
      }
    >
      {workspace && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (matches && acknowledged) onConfirm();
          }}
        >
          <Input
            label={`برای تایید، نام فضای کاری («${workspace.name}») را بنویسید`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            error={typed && !matches ? 'نام واردشده با نام فضای کاری یکسان نیست.' : undefined}
            data-autofocus
          />
          <Checkbox
            checked={acknowledged}
            onCheckedChange={setAcknowledged}
            label="می‌دانم که وظایف، گفتگوها، یادداشت‌ها و رویدادهای این فضا برای همه اعضا از بین می‌رود."
          />
        </form>
      )}
    </Modal>
  );
}
