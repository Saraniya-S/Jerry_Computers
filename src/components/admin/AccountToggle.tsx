"use client";

import { setDisabledAction } from "@/app/admin/team/actions";
import { ConfirmDialog, dangerButton, smallButton } from "./actions-ui";

/** Switch a customer account off (signing them out) or back on. */
export function AccountToggle({ userId, name, disabled }: { userId: string; name: string; disabled: boolean }) {
  return disabled ? (
    <ConfirmDialog
      title={`Switch ${name}'s account back on?`}
      tone="primary"
      confirmLabel="Switch on"
      onConfirm={() => setDisabledAction(userId, false)}
      trigger={(open) => (
        <button type="button" onClick={open} className={smallButton}>
          Switch on
        </button>
      )}
    >
      They can sign in, order and book services again.
    </ConfirmDialog>
  ) : (
    <ConfirmDialog
      title={`Switch off ${name}'s account?`}
      confirmLabel="Switch off"
      onConfirm={() => setDisabledAction(userId, true)}
      trigger={(open) => (
        <button type="button" onClick={open} className={dangerButton}>
          Switch off
        </button>
      )}
    >
      They are signed out and can&apos;t sign in. Their orders and service history are kept.
    </ConfirmDialog>
  );
}
