import { useState } from 'react';
import type { ReactNode } from 'react';
import { alert, Box, Button, Checkbox, Divider, Input, Loader, Pagination, Select, SelectItem, Text, Textarea, dialog } from '@inithium/ui';
import {
  formatCalendarDate,
  formatDate,
  formatMoney,
  LEDGER_CATEGORY_LABELS,
  LEDGER_METHOD_LABELS,
  parseMinorUnitsInput,
  readApiError,
  useAddLedgerChargeMutation,
  useGetUserLedgerQuery,
  useRecordLedgerPaymentMutation,
  useVoidLedgerEntryMutation,
} from '@inithium/api-client';
import type {
  AccountLedgerDto,
  LedgerChargeCategory,
  LedgerEntryDto,
  StaffLedgerPaymentMethod,
} from '@inithium/api-client';
import { DIALOG_WIDTH, FormError, MoneyInput, fullNameOf } from '../ecommerce/shared';

const PAGE_SIZE = 15;
const ALERT_POSITION = 'bottom-right' as const;
const NO_STUDENT = 'none';
const CATEGORIES = Object.keys(LEDGER_CATEGORY_LABELS) as LedgerChargeCategory[];
const STAFF_METHODS: StaffLedgerPaymentMethod[] = ['cash', 'check', 'card_in_person', 'other'];

const todayLocalDate = (): string => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

interface FormActionsProps {
  readonly submitLabel: string;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

const FormActions = ({ submitLabel, isSubmitting, onSubmit, onCancel }: FormActionsProps) => (
  <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
    <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} disabled={isSubmitting} onClick={onCancel}>
      Cancel
    </Button>
    <Button variant={{ kind: 'filled', color: 'primary' }} disabled={isSubmitting} onClick={onSubmit}>
      {isSubmitting ? 'Saving…' : submitLabel}
    </Button>
  </Box>
);

interface LedgerFormProps {
  readonly ledger: AccountLedgerDto;
  readonly onDone: () => void;
}

const AddChargeForm = ({ ledger, onDone }: LedgerFormProps) => {
  const [addCharge, { isLoading }] = useAddLedgerChargeMutation();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LedgerChargeCategory>('costume');
  const [studentId, setStudentId] = useState(NO_STUDENT);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    const amountCents = parseMinorUnitsInput(amount, ledger.currency);
    if (!amountCents) return setError('Enter an amount greater than zero.');
    if (!description.trim()) return setError('Enter a description.');
    try {
      await addCharge({
        userId: ledger.customer.id,
        amountCents,
        description: description.trim(),
        category,
        ...(studentId !== NO_STUDENT ? { studentId } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      alert.success('Charge added.', { position: ALERT_POSITION });
      onDone();
    } catch (submitError) {
      setError(readApiError(submitError, 'Could not add this charge.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Description" required placeholder="e.g. Recital costume" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Amount" required value={amount} onChange={setAmount} currency={ledger.currency} />
        <Select label="Category" value={category} onValueChange={(next) => setCategory(next as LedgerChargeCategory)}>
          {CATEGORIES.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {LEDGER_CATEGORY_LABELS[candidate]}
            </SelectItem>
          ))}
        </Select>
        <Select label="Student (optional)" value={studentId} onValueChange={setStudentId}>
          <SelectItem value={NO_STUDENT}>No specific student</SelectItem>
          {ledger.students.map((student) => (
            <SelectItem key={student.id} value={student.id}>
              {student.name}
            </SelectItem>
          ))}
        </Select>
        <Input label="Due date (optional)" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </Box>
      <Textarea label="Staff note (optional)" helperText="Only visible to staff." rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      <FormError message={error} />
      <FormActions submitLabel="Add charge" isSubmitting={isLoading} onSubmit={submit} onCancel={onDone} />
    </Box>
  );
};

const RecordPaymentForm = ({ ledger, onDone }: LedgerFormProps) => {
  const [recordPayment, { isLoading }] = useRecordLedgerPaymentMutation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<StaffLedgerPaymentMethod>('cash');
  const [checkNumber, setCheckNumber] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayLocalDate);
  const [note, setNote] = useState('');
  const [chargeIds, setChargeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const toggleCharge = (chargeId: string, checked: boolean) =>
    setChargeIds(checked ? [...chargeIds, chargeId] : chargeIds.filter((id) => id !== chargeId));

  const submit = async () => {
    setError(undefined);
    const amountCents = parseMinorUnitsInput(amount, ledger.currency);
    if (!amountCents) return setError('Enter an amount greater than zero.');
    if (method === 'check' && !checkNumber.trim()) return setError('Enter the check number.');
    if (!receivedOn) return setError('Enter the date this was received.');
    try {
      await recordPayment({
        userId: ledger.customer.id,
        amountCents,
        method,
        receivedAt: receivedOn,
        ...(method === 'check' ? { checkNumber: checkNumber.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(chargeIds.length > 0 ? { chargeIds } : {}),
      }).unwrap();
      alert.success('Payment recorded.', { position: ALERT_POSITION });
      onDone();
    } catch (submitError) {
      setError(readApiError(submitError, 'Could not record this payment.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Amount" required value={amount} onChange={setAmount} currency={ledger.currency} />
        <Select label="Method" value={method} onValueChange={(next) => setMethod(next as StaffLedgerPaymentMethod)}>
          {STAFF_METHODS.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {LEDGER_METHOD_LABELS[candidate]}
            </SelectItem>
          ))}
        </Select>
        {method === 'check' ? <Input label="Check number" required value={checkNumber} onChange={(event) => setCheckNumber(event.target.value)} /> : null}
        <Input label="Date received" type="date" required value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
      </Box>
      {ledger.openCharges.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
            Apply to specific charges (optional)
          </Text>
          {ledger.openCharges.map((charge) => (
            <Checkbox
              key={charge.chargeId}
              label={`${charge.description} · ${formatMoney(charge.remainingCents, ledger.currency)} open`}
              checked={chargeIds.includes(charge.chargeId)}
              onCheckedChange={(checked) => toggleCharge(charge.chargeId, checked === true)}
            />
          ))}
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            Leave these unticked to pay the oldest charges first. Anything left over stays on the account as a credit.
          </Text>
        </Box>
      ) : null}
      <Textarea label="Staff note (optional)" helperText="Only visible to staff." rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      <FormError message={error} />
      <FormActions submitLabel="Record payment" isSubmitting={isLoading} onSubmit={submit} onCancel={onDone} />
    </Box>
  );
};

const VoidForm = ({ entry, onDone }: { readonly entry: LedgerEntryDto; readonly onDone: () => void }) => {
  const [voidEntry, { isLoading }] = useVoidLedgerEntryMutation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    if (!reason.trim()) return setError('Enter a reason.');
    try {
      await voidEntry({ entryId: entry.id, reason: reason.trim() }).unwrap();
      alert.success('Entry voided.', { position: ALERT_POSITION });
      onDone();
    } catch (submitError) {
      setError(readApiError(submitError, 'Could not void this entry.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        {`"${entry.description}" stays on the ledger, crossed out with your reason, and stops counting toward the balance. This can't be undone. The family can see the reason.`}
      </Text>
      <Input label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
      <FormError message={error} />
      <FormActions submitLabel="Void entry" isSubmitting={isLoading} onSubmit={submit} onCancel={onDone} />
    </Box>
  );
};

const entryDetails = (entry: LedgerEntryDto): string =>
  [
    entry.kind === 'charge' && entry.category ? LEDGER_CATEGORY_LABELS[entry.category] : undefined,
    entry.studentName,
    entry.method ? LEDGER_METHOD_LABELS[entry.method] : undefined,
    entry.checkNumber ? `Check #${entry.checkNumber}` : undefined,
    entry.receivedAt ? `Received ${entry.source === 'staff' ? formatCalendarDate(entry.receivedAt) : formatDate(entry.receivedAt)}` : undefined,
    entry.dueDate ? `Due ${formatCalendarDate(entry.dueDate)}` : undefined,
    entry.source === 'staff' ? undefined : entry.source === 'system' ? 'Monthly tuition (pays in person)' : 'From an order',
  ]
    .filter(Boolean)
    .join(' · ');

const EntryRow = ({ entry, currency, onVoid }: { readonly entry: LedgerEntryDto; readonly currency: string; readonly onVoid: (entry: LedgerEntryDto) => void }) => {
  const isVoided = Boolean(entry.voidedAt);
  // Payments read as money coming off the balance, so their sign is flipped for display.
  const signedAmount = entry.kind === 'payment' ? -entry.amountCents : entry.amountCents;

  return (
    <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} padding={{ base: 12 }}>
      <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
        <Text as="span" textColor={{ color: 'surface', intensity: isVoided ? 600 : 950 }} className={`font-medium ${isVoided ? 'line-through' : ''}`}>
          {entry.description}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          {[formatDate(entry.createdAt), entryDetails(entry)].filter(Boolean).join(' · ')}
        </Text>
        {entry.note ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-xs italic">
            {entry.note}
          </Text>
        ) : null}
        {entry.voidedAt ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-xs">
            {`Voided ${formatDate(entry.voidedAt)}: ${entry.voidReason ?? ''}`}
          </Text>
        ) : null}
      </Box>
      <Text as="span" textColor={{ color: 'surface', intensity: isVoided ? 600 : 950 }} className={`font-semibold tabular-nums ${isVoided ? 'line-through' : ''}`}>
        {formatMoney(signedAmount, currency)}
      </Text>
      {/* Posted tuition can be voided to waive a month; order entries change only through their order. */}
      {!isVoided && (entry.source === 'staff' || entry.source === 'system') ? (
        <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => onVoid(entry)}>
          Void
        </Button>
      ) : null}
    </Box>
  );
};

const balanceLabel = (ledger: AccountLedgerDto): string => {
  if (ledger.balanceCents > 0) return `${formatMoney(ledger.balanceCents, ledger.currency)} owed`;
  if (ledger.balanceCents < 0) return `${formatMoney(-ledger.balanceCents, ledger.currency)} credit`;
  return 'Paid up';
};

// One account's balance and history, with the staff actions. Shared by the Accounts module and the
// shortcuts in Users and Orders.
export const AccountLedgerPanel = ({ userId }: { readonly userId: string }) => {
  const [page, setPage] = useState(1);
  const { data: ledger, isLoading, isError } = useGetUserLedgerQuery({ userId, page, pageSize: PAGE_SIZE }, { refetchOnMountOrArgChange: true });

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }
  if (isError || !ledger) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        This account could not be loaded.
      </Text>
    );
  }

  const openForm = (title: string, render: (close: () => void) => ReactNode) => {
    const id = dialog.show(() => render(() => dialog.close(id)), { title, width: DIALOG_WIDTH });
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', wrap: 'wrap', gap: 12 }}>
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
            {fullNameOf(ledger.customer)}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {ledger.customer.email}
          </Text>
        </Box>
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold tabular-nums">
          {balanceLabel(ledger)}
        </Text>
      </Box>

      <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openForm('Add charge', (close) => <AddChargeForm ledger={ledger} onDone={close} />)}>
          Add charge
        </Button>
        <Button
          variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
          textColor={{ color: 'surface', intensity: 900 }}
          onClick={() => openForm('Record payment', (close) => <RecordPaymentForm ledger={ledger} onDone={close} />)}
        >
          Record payment
        </Button>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {ledger.entries.length === 0 ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} padding={{ base: 16 }} className="text-sm">
            Nothing on this account yet.
          </Text>
        ) : (
          ledger.entries.map((entry, index) => (
            <Box key={entry.id}>
              {index > 0 ? <Divider color={{ color: 'surface', intensity: 200 }} /> : null}
              <EntryRow
                entry={entry}
                currency={ledger.currency}
                onVoid={(target) => openForm('Void entry', (close) => <VoidForm entry={target} onDone={close} />)}
              />
            </Box>
          ))
        )}
      </Box>

      {ledger.totalPages > 1 ? <Pagination page={ledger.page} totalPages={ledger.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
