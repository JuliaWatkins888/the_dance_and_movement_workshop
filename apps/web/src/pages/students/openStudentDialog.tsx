import { dialog } from '@inithium/ui';
import type { ChildDto } from '@inithium/api-client';
import { ChildFormDialog } from './ChildFormDialog';

const DIALOG_WIDTH = 480;

export const studentFullName = (student: ChildDto): string =>
  student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName;

export interface OpenStudentDialogOptions {
  // Present when editing; adds a new student otherwise.
  readonly student?: ChildDto;
  readonly onSaved: (student: ChildDto) => void;
}

export const openStudentDialog = ({ student, onSaved }: OpenStudentDialogOptions): void => {
  const id = dialog.show(
    () => (
      <ChildFormDialog
        initialChild={student}
        onCancel={() => dialog.close(id)}
        onSaved={(saved) => {
          dialog.close(id);
          onSaved(saved);
        }}
      />
    ),
    { title: student ? `Edit ${studentFullName(student)}` : 'Add Student', width: DIALOG_WIDTH },
  );
};
