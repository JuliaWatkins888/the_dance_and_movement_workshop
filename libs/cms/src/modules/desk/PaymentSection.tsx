import type { Ref } from 'react';
import { Box, Checkbox, Input, PaymentFields, RadioGroup, RadioGroupItem, Select, SelectItem, Text } from '@inithium/ui';
import type { PaymentFieldsHandle } from '@inithium/ui';
import { LEDGER_METHOD_LABELS, useGetStoreConfigQuery } from '@inithium/api-client';
import type { PostalAddressInput, StaffLedgerPaymentMethod } from '@inithium/api-client';
import { AddressInputs } from '../ecommerce/AddressInputs';
import { MoneyInput } from '../ecommerce/shared';

export type DeskPaymentMode = 'card' | 'in_person';

const STAFF_METHODS: StaffLedgerPaymentMethod[] = ['cash', 'check', 'card_in_person', 'other'];

export interface DeskRecordDraft {
  enabled: boolean;
  method: StaffLedgerPaymentMethod;
  amount: string;
  checkNumber: string;
}

interface PaymentSectionProps {
  readonly mode: DeskPaymentMode;
  readonly onModeChange: (mode: DeskPaymentMode) => void;
  readonly billingAddress: PostalAddressInput;
  readonly onBillingAddressChange: (next: PostalAddressInput) => void;
  readonly record: DeskRecordDraft;
  readonly onRecordChange: (next: DeskRecordDraft) => void;
  readonly paymentRef: Ref<PaymentFieldsHandle>;
  readonly amountCents: number;
  readonly currency: string;
  readonly hasRecurring: boolean;
}

export const PaymentSection = ({
  mode,
  onModeChange,
  billingAddress,
  onBillingAddressChange,
  record,
  onRecordChange,
  paymentRef,
  amountCents,
  currency,
  hasRecurring,
}: PaymentSectionProps) => {
  const payment = useGetStoreConfigQuery().data?.payment ?? null;

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <RadioGroup label="How is this paid?" value={mode} onValueChange={(value) => onModeChange(value as DeskPaymentMode)}>
        <RadioGroupItem value="card" label="Card now: the family enters their card on this screen" />
        <RadioGroupItem value="in_person" label="Pay in person: put it on the family’s account (cash, check, or later)" />
      </RadioGroup>

      {mode === 'card' ? (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {hasRecurring
              ? 'Monthly classes are charged now for the first month, then renew on this card on the 1st of each month, the same as online.'
              : 'The card is charged now. Sales tax is calculated from the billing address, the same as online.'}
          </Text>
          <AddressInputs value={billingAddress} onChange={onBillingAddressChange} nameLabel="Name on card" />
          {payment ? (
            amountCents > 0 ? (
              <PaymentFields
                ref={paymentRef}
                provider={payment.provider}
                publishableKey={payment.publishableKey}
                amountCents={amountCents}
                currency={currency}
                saveForFutureUse={hasRecurring}
              />
            ) : null
          ) : (
            <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
              Card payments aren’t set up on this site. Use “Pay in person” instead.
            </Text>
          )}
        </Box>
      ) : (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {hasRecurring
              ? 'Nothing is charged to a card. The total goes on the family’s account, and each monthly class posts its tuition there on the 1st of every month.'
              : 'Nothing is charged to a card. The total goes on the family’s account.'}
          </Text>
          <Checkbox
            label="Record a payment taken now"
            checked={record.enabled}
            onCheckedChange={(checked) => onRecordChange({ ...record, enabled: checked === true })}
          />
          {record.enabled ? (
            <Box className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select label="Method" value={record.method} onValueChange={(method) => onRecordChange({ ...record, method: method as StaffLedgerPaymentMethod })}>
                {STAFF_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {LEDGER_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </Select>
              <MoneyInput label="Amount" value={record.amount} onChange={(amount) => onRecordChange({ ...record, amount })} currency={currency} required />
              {record.method === 'check' ? (
                <Input label="Check number" required value={record.checkNumber} onChange={(event) => onRecordChange({ ...record, checkNumber: event.target.value })} />
              ) : null}
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
};
