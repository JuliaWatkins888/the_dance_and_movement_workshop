import { dialog } from '@inithium/ui';
import type { NotificationHook } from '../registry';
import { ContactThreadDialogContent } from '../../pages/ContactThreadDialogContent';

// 'contact:replied' notifications carry a communication id in actionUrl (as
// "/contact/thread/<id>") purely as a string carrier, never as a real route - intercepted here
// before the registry's default navigate() fallback ever sees it.
const extractCommunicationThreadId = (actionUrl?: string): string | undefined =>
  actionUrl?.match(/^\/contact\/thread\/(.+)$/)?.[1];

const contactNotificationHook: NotificationHook = {
  test: (notification) => notification.type === 'contact:replied',
  onClick: (notification) => {
    const communicationId = extractCommunicationThreadId(notification.actionUrl);
    if (!communicationId) return;
    dialog.show(() => <ContactThreadDialogContent communicationId={communicationId} />, {
      title: 'Your message',
      width: 600,
    });
  },
};

export default contactNotificationHook;
