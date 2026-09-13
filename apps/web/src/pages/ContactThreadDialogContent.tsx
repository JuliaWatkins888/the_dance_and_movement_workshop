import { Box, CommunicationThread, Text } from '@inithium/ui';
import { useAddContactMessageMutation, useGetContactThreadQuery } from '@inithium/api-client';

export interface ContactThreadDialogContentProps {
  readonly communicationId: string;
}

// Opened from app.tsx's onNotificationClick when a 'contact:replied' notification is clicked -
// a dialog instead of a navigation, since the whole point is letting the submitter keep the
// correspondence going without leaving whatever page they were on.
export const ContactThreadDialogContent = ({ communicationId }: ContactThreadDialogContentProps) => {
  const { data: communication, isLoading, isError } = useGetContactThreadQuery(communicationId);
  const [addContactMessage, { isLoading: isSending }] = useAddContactMessageMutation();

  // An admin can permanently delete a communication - a notification that still points at one
  // (not yet refreshed out of this browser's notification center) lands here as a 404.
  if (isError) {
    return (
      <Box padding={{ base: 24 }}>
        <Text as="p" className="text-surface-500">
          This message is no longer available. It may have been deleted.
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
    <CommunicationThread
      communication={communication}
      viewerRole="submitter"
      isSending={isSending}
      onSendMessage={async (body) => {
        await addContactMessage({ id: communicationId, body }).unwrap();
      }}
    />
  );
};
