import { RadioGroup, RadioGroupItem } from '@inithium/ui';
import type { SemesterSummaryDto } from '@inithium/api-client';

export interface SemesterScopeFieldProps {
  readonly label: string;
  // The semesters the admin may choose from: a year's semesters when scoping a Course, the parent
  // Course's own semesters when scoping a Class.
  readonly available: readonly Pick<SemesterSummaryDto, 'id' | 'name'>[];
  readonly value: string[];
  readonly onChange: (semesterIds: string[]) => void;
  readonly helperText?: string;
}

const FULL_YEAR_VALUE = '__full-year__';

// One radio choice per way of covering the available semesters: every one together ("Full year",
// only offered when there's more than one to combine) or each one alone. Shared by the Course and
// Class dialogs so both express "which term(s)" identically.
export const SemesterScopeField = ({ label, available, value, onChange, helperText }: SemesterScopeFieldProps) => {
  const allIds = available.map((semester) => semester.id);
  const canSpanYear = available.length > 1;
  const coversAll = allIds.length > 0 && allIds.every((id) => value.includes(id));

  const selected = canSpanYear && coversAll ? FULL_YEAR_VALUE : (value.length === 1 ? value[0] : '');

  const handleChange = (next: string) => onChange(next === FULL_YEAR_VALUE ? allIds : [next]);

  return (
    <RadioGroup label={label} required value={selected} onValueChange={handleChange} helperText={helperText}>
      {canSpanYear ? <RadioGroupItem value={FULL_YEAR_VALUE} label="Full year (both semesters)" /> : null}
      {available.map((semester) => (
        <RadioGroupItem key={semester.id} value={semester.id} label={canSpanYear ? `${semester.name} only` : semester.name} />
      ))}
    </RadioGroup>
  );
};
