import { Box, Button, Loader, Text, dialog } from '@inithium/ui';
import { useGetContactInboxQuery } from '@inithium/api-client';
import { CommunicationThreadDialogContent } from '../../modules/communications/CommunicationThreadDialogContent';
import { communicationNeedsReply } from '../../modules/communications/communicationNeedsReply';
import type { DashboardWidget } from './registry';

const WIDGET_PAGE_SIZE = 50;
const MAX_ROWS_SHOWN = 5;

// "See the full message and respond" straight from the dashboard, not just a count - reuses the
// exact same CommunicationThreadDialogContent the full Communications module opens on a row
// click, so there's only one place that renders/wires a reply form.
const CommunicationsNeedingReplyWidget = () => {
  const { data, isLoading, refetch } = useGetContactInboxQuery({ page: 1, pageSize: WIDGET_PAGE_SIZE });

  if (isLoading) {
    return <Loader variant="spinner" size="2rem" />;
  }

  const needingReply = (data?.items ?? []).filter(communicationNeedsReply);

  if (needingReply.length === 0) {
    return (
      <Text as="p" className="text-surface-500">
        Nothing waiting on a reply.
      </Text>
    );
  }

  const openThread = (communicationId: string, title: string) => {
    dialog.show(() => <CommunicationThreadDialogContent communicationId={communicationId} onReplySent={refetch} />, {
      title,
      width: 600,
    });
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      {needingReply.slice(0, MAX_ROWS_SHOWN).map((communication) => (
        <Box
          key={communication.id}
          flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}
          borderColor={{ color: 'surface', intensity: 200 }}
          padding={{ base: 8 }}
          className="rounded border"
        >
          <Box flex={{ direction: 'col' }} className="min-w-0">
            <Text as="span" className="truncate font-medium text-surface-950">
              {communication.subject}
            </Text>
            <Text as="span" className="truncate text-xs text-surface-600">
              {communication.firstName} {communication.lastName}
            </Text>
          </Box>
          <Button
            variant={{ kind: 'filled', color: 'primary' }}
            className="shrink-0"
            onClick={() => openThread(communication.id, communication.subject)}
          >
            Respond
          </Button>
        </Box>
      ))}
      {needingReply.length > MAX_ROWS_SHOWN ? (
        <Text as="p" className="text-xs text-surface-500">
          +{needingReply.length - MAX_ROWS_SHOWN} more awaiting reply
        </Text>
      ) : null}
    </Box>
  );
};

const communicationsNeedingReplyWidget: DashboardWidget = {
  id: 'communications-needing-reply',
  title: 'Contact Messages Awaiting Reply',
  order: 10,
  span: 1,
  requiredCapability: 'contact:manageThreads',
  Component: CommunicationsNeedingReplyWidget,
};

export default communicationsNeedingReplyWidget;
