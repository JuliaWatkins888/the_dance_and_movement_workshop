import { useState } from 'react';
import { Box, Button, Input } from '../components';
import { alert } from '../alert/alert';

export interface ChangePasswordDialogProps {
  // Verifies the current password only - never itself authorizes the change (the caller's real
  // backend call re-verifies again before actually updating anything). Resolving `false` (rather
  // than throwing) is the "wrong password" outcome; a thrown rejection is treated the same way.
  readonly onVerify: (currentPassword: string) => Promise<boolean>;
  readonly onSubmit: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  readonly onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;
const ALERT_POSITION = 'bottom-right' as const;

// Two-step flow: verify the current password first (server round-trip, since a client-only
// check can't know the real value), then reveal the new/confirm fields. Prop-driven rather than
// calling @inithium/api-client hooks directly - this package stays decoupled from any specific
// persistence layer, matching Navbar's own callback-based contract (onLogin/onLogout) rather
// than the CMS's UserFormDialog, which is allowed to reach into api-client because it lives in
// the cms plugin's own admin-app layer, not here.
export const ChangePasswordDialog = ({ onVerify, onSubmit, onClose }: ChangePasswordDialogProps) => {
  const [step, setStep] = useState<'verify' | 'set-new'>('verify');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<string | undefined>(undefined);
  const [newPasswordError, setNewPasswordError] = useState<string | undefined>(undefined);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!currentPassword) {
      setCurrentPasswordError('Current password is required.');
      return;
    }

    setCurrentPasswordError(undefined);
    setIsVerifying(true);
    try {
      const valid = await onVerify(currentPassword);
      if (!valid) {
        setCurrentPasswordError('Incorrect password.');
        alert.danger('Incorrect password.', { position: ALERT_POSITION });
        return;
      }
      setStep('set-new');
    } catch {
      setCurrentPasswordError('Incorrect password.');
      alert.danger('Incorrect password.', { position: ALERT_POSITION });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    const nextNewPasswordError =
      newPassword.length < MIN_PASSWORD_LENGTH ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` : undefined;
    const nextConfirmPasswordError = confirmPassword !== newPassword ? 'Passwords do not match.' : undefined;
    setNewPasswordError(nextNewPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);
    if (nextNewPasswordError || nextConfirmPasswordError) {
      alert.danger('Please fix the highlighted fields.', { position: ALERT_POSITION });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ currentPassword, newPassword });
      onClose();
      alert.success('Password changed successfully.', { position: ALERT_POSITION });
    } catch {
      alert.danger('Could not change your password. Please try again.', { position: ALERT_POSITION });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'verify') {
    return (
      <Box flex={{ direction: 'col', gap: 16 }}>
        <Input
          label="Current Password"
          type="password"
          required
          autoFocus
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          error={Boolean(currentPasswordError)}
          helperText={currentPasswordError}
        />
        <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onClose} disabled={isVerifying}>
            Cancel
          </Button>
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleContinue} disabled={isVerifying}>
            {isVerifying ? 'Checking…' : 'Continue'}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input
        label="New Password"
        type="password"
        required
        autoFocus
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={Boolean(newPasswordError)}
        helperText={newPasswordError}
      />
      <Input
        label="Confirm New Password"
        type="password"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={Boolean(confirmPasswordError)}
        helperText={confirmPasswordError}
      />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Change Password'}
        </Button>
      </Box>
    </Box>
  );
};
