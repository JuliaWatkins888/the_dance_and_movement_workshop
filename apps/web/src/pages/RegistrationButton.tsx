import { Button, useNavigateWithTransition } from '@inithium/ui';
import type { RegistrationStatus, ContactMessage } from './registrationStatus';

export interface RegistrationButtonProps {
  readonly status: RegistrationStatus;
  // ISO string - only read when status is 'not-yet-open'.
  readonly opensAt?: string;
  // Where an 'open' click lands - RegisterPage.tsx's scaffold, distinct per offering
  // (e.g. /register/class/<id> or /register/workshop/<id>).
  readonly registerPath: string;
  // Prefills the Contact page's subject/message for a 'full'/'closed' exception request (see
  // ContactPage.tsx's own read of these query params and registrationStatus.ts's builders).
  readonly fullContactMessage: ContactMessage;
  readonly closedContactMessage: ContactMessage;
  readonly className?: string;
}

const opensAtFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const buildContactPath = ({ subject, body }: ContactMessage): string =>
  `/contact?${new URLSearchParams({ subject, message: body }).toString()}`;

// 'open' goes to the (currently scaffolded) Register page - a real next step, distinct from
// asking staff to make an exception. 'full'/'closed' route to Contact instead, each with a
// prefilled message that explicitly frames the request as "I know I shouldn't be able to, but
// could you make an exception?" (see registrationStatus.ts). "not-yet-open" is the one status
// with no escape hatch at all - the studio's own rule is that a visitor can never register before
// the window opens, full stop, so it just stays disabled.
export const RegistrationButton = ({
  status,
  opensAt,
  registerPath,
  fullContactMessage,
  closedContactMessage,
  className = 'w-full',
}: RegistrationButtonProps) => {
  const navigate = useNavigateWithTransition();

  if (status === 'open') {
    return (
      <Button variant={{ kind: 'filled', color: 'primary' }} className={className} onClick={() => navigate(registerPath)}>
        Register
      </Button>
    );
  }

  if (status === 'full' || status === 'closed') {
    const message = status === 'full' ? fullContactMessage : closedContactMessage;
    return (
      <Button variant={{ kind: 'filled', color: 'primary' }} className={className} onClick={() => navigate(buildContactPath(message))}>
        Contact to Register
      </Button>
    );
  }

  return (
    <Button variant={{ kind: 'filled', color: 'primary' }} className={className} disabled>
      {opensAt ? `Registration Starts ${opensAtFormatter.format(new Date(opensAt))}` : 'Registration Opening Soon'}
    </Button>
  );
};
