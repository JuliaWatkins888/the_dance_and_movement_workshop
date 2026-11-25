import type { ReactElement } from 'react';
import { alert, Box, Button, dialog } from '@inithium/ui';
import { readApiError, useClearPrivateLessonExceptionMutation, useSetPrivateLessonExceptionMutation } from '@inithium/api-client';
import type { PrivateLessonOccurrenceDto } from '@inithium/api-client';
import { ALERT_POSITION, DIALOG_WIDTH } from '../classes/classAdmin.shared';
import { MoveOccurrenceDialog } from './MoveOccurrenceDialog';
import { formatLongDay } from './privateLessonFormat';

const openMoveDialog = (occurrence: PrivateLessonOccurrenceDto) => {
  const render = (close: () => void): ReactElement => <MoveOccurrenceDialog occurrence={occurrence} onDone={close} />;
  const id = dialog.show(() => render(() => dialog.close(id)), { title: 'Move one lesson', width: DIALOG_WIDTH });
};

// Cancel / Move / Undo for one occurrence. Nothing is offered once it has started: by then it's
// billed, and staff void the charge in Accounts to waive it.
export const OccurrenceActions = ({ occurrence, label }: { readonly occurrence: PrivateLessonOccurrenceDto; readonly label: string }) => {
  const [setException, { isLoading: isSetting }] = useSetPrivateLessonExceptionMutation();
  const [clearException, { isLoading: isClearing }] = useClearPrivateLessonExceptionMutation();
  const isBusy = isSetting || isClearing;
  if (occurrence.hasStarted) return null;

  const cancel = async () => {
    const confirmed = await dialog.confirm({
      title: `Cancel ${label} on ${formatLongDay(occurrence.date)}?`,
      description: 'Only this date is cancelled and it won’t be charged. The rest of the schedule stays.',
      confirmLabel: 'Cancel lesson',
      cancelLabel: 'Keep it',
      confirmVariant: { kind: 'filled', color: 'red', intensity: 600 },
    });
    if (!confirmed) return;
    try {
      await setException({ lessonId: occurrence.lessonId, kind: 'cancelled', date: occurrence.scheduledDate }).unwrap();
      alert.success('Lesson cancelled.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not cancel this lesson.').message, { position: ALERT_POSITION });
    }
  };

  const undo = async () => {
    try {
      await clearException({ lessonId: occurrence.lessonId, date: occurrence.scheduledDate }).unwrap();
      alert.success(`Back on ${formatLongDay(occurrence.scheduledDate)}.`, { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not undo this change.').message, { position: ALERT_POSITION });
    }
  };

  const isChanged = occurrence.status === 'cancelled' || occurrence.isMoved;
  return (
    <Box flex={{ direction: 'row', gap: 4 }} className="shrink-0">
      {occurrence.status === 'scheduled' ? (
        <>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => openMoveDialog(occurrence)} disabled={isBusy}>
            Move
          </Button>
          <Button variant={{ kind: 'ghost', color: 'red' }} textColor={{ color: 'red', intensity: 600 }} onClick={cancel} disabled={isBusy}>
            Cancel
          </Button>
        </>
      ) : null}
      {isChanged ? (
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={undo} disabled={isBusy}>
          {isClearing ? 'Undoing…' : occurrence.status === 'cancelled' ? 'Restore' : 'Undo move'}
        </Button>
      ) : null}
    </Box>
  );
};
