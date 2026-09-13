import { Box, CommunicationThread, Text } from '@inithium/ui';
import { useAddContactMessageMutation, useGetContactThreadQuery } from '@inithium/api-client';

export interface CommunicationThreadDialogContentProps {
  readonly communicationId: string;
  readonly onReplySent?: () => void;
}

// The admin-side counterpart of apps/web's ContactThreadDialogContent - same shared
// CommunicationThread component, same endpoints, just viewerRole="admin" so an admin's own
// messages render as "mine". Opened from both CommunicationsAdminModule's list rows and the
// dashboard's communications-needing-reply widget.
export const CommunicationThreadDialogContent = ({ communicationId, onReplySent }: CommunicationThreadDialogContentProps) => {
  const { data: communication, isLoading, isError } = useGetContactThreadQuery(communicationId);
  const [addContactMessage, { isLoading: isSending }] = useAddContactMessageMutation();

  // Reachable if this thread was already deleted elsewhere (another admin, or a stale
  // notification-driven ?threadId= link) since the last time this list/query was fetched.
  if (isError) {
    return (
      <Box padding={{ base: 24 }}>
        <Text as="p" className="text-surface-500">
          This conversation is no longer available. It may have been deleted.
        </Text>
      </Box>
    );
  }

  if (isLoading || !communication) {
    return (
      <Box padding={{ base: 24 }}>
        <Text as="p" className="text-surface-500">
          Loading...
        </Text>
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Text as="p" className="text-sm text-surface-600">
        From {communication.firstName} {communication.lastName} ({communication.email})
      </Text>
      <CommunicationThread
        communication={communication}
        viewerRole="admin"
        isSending={isSending}
        onSendMessage={async (body) => {
          await addContactMessage({ id: communicationId, body }).unwrap();
          onReplySent?.();
        }}
      />
    </Box>
  );
};
