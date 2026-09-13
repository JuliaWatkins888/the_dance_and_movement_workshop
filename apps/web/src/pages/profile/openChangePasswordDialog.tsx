import { ChangePasswordDialog, dialog } from '@inithium/ui';
import { useChangePasswordMutation, useVerifyCurrentPasswordMutation } from '@inithium/api-client';

// Single shared trigger for the "Change Password" flow, used both by the Navbar's
// disabled-profile drawer shortcut (app.tsx) and the profile page's own account-settings
// section - one wiring of the mutations, not two copies of the same dialog.show(...) call.
export const useOpenChangePasswordDialog = (): (() => void) => {
  const [verifyCurrentPassword] = useVerifyCurrentPasswordMutation();
  const [changePassword] = useChangePasswordMutation();

  return () => {
    dialog.show(
      ({ close }) => (
        <ChangePasswordDialog
          onVerify={async (currentPassword) => {
            try {
              return await verifyCurrentPassword(currentPassword).unwrap();
            } catch {
              return false;
            }
          }}
          onSubmit={async (input) => {
            await changePassword(input).unwrap();
          }}
          onClose={close}
        />
      ),
      { title: 'Change Password', width: 420 },
    );
  };
};
