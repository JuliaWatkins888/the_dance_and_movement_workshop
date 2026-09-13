import { useState } from 'react';
import { Box, Button, Text, Textarea } from '../components';

// A local, decoupled shape rather than an import of @inithium/db's CommunicationEntity - this
// component takes plain data from whatever the host already fetched (a JSON API response, so
// dates are ISO strings, not Date instances) and never depends on @inithium/db's domain types,
// keeping libs/ui's usual data-fetching-agnostic boundary intact.
export type CommunicationThreadAuthorRole = 'submitter' | 'admin';

export interface CommunicationThreadMessage {
  readonly id: string;
  readonly authorRole: CommunicationThreadAuthorRole;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface CommunicationThreadData {
  readonly messages: readonly CommunicationThreadMessage[];
}

export interface CommunicationThreadProps {
  // The host resolves this via @inithium/api-client (useGetContactThreadQuery on the public
  // site, the CMS Communications module's own inbox query in the CMS) and passes the plain
  // result down - this component does no fetching of its own, mirroring how NotificationCenter
  // stays presentational and lets each host wire up its own data.
  readonly communication: CommunicationThreadData;
  // Whose messages render as "mine" (right-aligned) vs "theirs" (left-aligned) - 'submitter' on
  // the public site, 'admin' inside the CMS.
  readonly viewerRole: CommunicationThreadAuthorRole;
  readonly onSendMessage: (body: string) => void | Promise<void>;
  readonly isSending?: boolean;
}

const formatTimestamp = (value: string): string => new Date(value).toLocaleString();

// An open-ended chat thread, not a single comment+reply pair - unlike blog's BlogCommentsPanel,
// the reply box never disappears once a message exists, since either side can keep the
// correspondence going for as long as the inquiry needs.
export const CommunicationThread = ({ communication, viewerRole, onSendMessage, isSending }: CommunicationThreadProps) => {
  const [draft, setDraft] = useState('');

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;
    await onSendMessage(draft.trim());
    setDraft('');
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 12 }} className="max-h-[50vh] overflow-y-auto">
        {communication.messages.map((message) => {
          const isMine = message.authorRole === viewerRole;
          return (
            <Box
              key={message.id}
              flex={{ direction: 'col', gap: 4 }}
              bgColor={{ color: 'surface', intensity: isMine ? 200 : 100 }}
              padding={{ base: 12 }}
              className={`max-w-[85%] rounded-md ${isMine ? 'self-end' : 'self-start'}`}
            >
              <Box flex={{ direction: 'row', justify: 'between', gap: 16 }}>
                <Text as="span" className="text-xs font-semibold text-surface-700">
                  {isMine ? 'You' : message.authorName}
                </Text>
                <Text as="span" className="shrink-0 text-xs text-surface-500">
                  {formatTimestamp(message.createdAt)}
                </Text>
              </Box>
              <Text as="p" className="whitespace-pre-wrap text-sm text-surface-950">
                {message.body}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Textarea
          label="Message"
          placeholder="Write a message..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
        />
        <Button
          variant={{ kind: 'filled', color: 'primary' }}
          disabled={isSending || !draft.trim()}
          onClick={handleSend}
          className="self-end"
        >
          {isSending ? 'Sending…' : 'Send'}
        </Button>
      </Box>
    </Box>
  );
};
