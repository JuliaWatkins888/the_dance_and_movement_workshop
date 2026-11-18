import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { alert, Box, Button, Divider, Input, Text, dialog } from '@inithium/ui';
import type { PaymentFieldsHandle } from '@inithium/ui';
import {
  POLICY_CONSENT_REQUIRED,
  POLICY_VERSION_CHANGED,
  formatMoney,
  parseMinorUnitsInput,
  readApiError,
  useConfirmDeskOrderPaymentMutation,
  useCreateDeskOrderMutation,
  useGetDeskAccountQuery,
  useQuoteDeskOrderMutation,
} from '@inithium/api-client';
import type {
  CheckoutQuoteDto,
  DeskAccountDetailDto,
  DeskOrderInput,
  DeskOrderResultDto,
  DeskPaymentInput,
  DeskQuoteDto,
  DeskQuoteInput,
  PostalAddressInput,
} from '@inithium/api-client';
import { canAccessCmsResource, useCmsCurrentUser } from '../../CmsCurrentUserContext';
import { emptyAddress, toAddressPayload } from '../ecommerce/AddressInputs';
import { DIALOG_WIDTH_WIDE, FormError, useStoreCurrency } from '../ecommerce/shared';
import { openAccountLedger } from '../ledger/openAccountLedger';
import { OrderAdminDetail } from '../orders/OrderAdminDetail';
import { AccountSection } from './AccountSection';
import { openAccountRegistrations } from './AccountRegistrationsPanel';
import { ItemsSection } from './ItemsSection';
import { PaymentSection } from './PaymentSection';
import type { DeskPaymentMode, DeskRecordDraft } from './PaymentSection';
import { PolicySection, validateDeskConsent } from './PolicySection';
import type { DeskConsentDraft } from './PolicySection';
import { SECTION_TITLE_CLASS, personName, useDebounced } from './deskShared';
import type { DeskLine } from './deskShared';
import { StudentsSection } from './StudentsSection';

const ALERT_POSITION = 'bottom-right' as const;
const QUOTE_DEBOUNCE_MS = 400;

const emptyRecord: DeskRecordDraft = { enabled: false, method: 'cash', amount: '', checkNumber: '' };
const emptyConsent: DeskConsentDraft = { method: 'desk', signedName: '' };

const Section = ({ step, title, children }: { readonly step: number; readonly title: string; readonly children: ReactNode }) => (
  <Box flex={{ direction: 'col', gap: 12 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 16 }} className="rounded-lg border">
    <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className={SECTION_TITLE_CLASS}>
      {`${step}. ${title}`}
    </Text>
    {children}
  </Box>
);

const SummaryRow = ({ label, value, strong }: { readonly label: string; readonly value: string; readonly strong?: boolean }) => (
  <Box flex={{ direction: 'row', justify: 'between' }}>
    <Text as="span" textColor={{ color: 'surface', intensity: strong ? 950 : 700 }} className={strong ? 'font-semibold' : 'text-sm'}>
      {label}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className={strong ? 'font-bold tabular-nums' : 'text-sm tabular-nums'}>
      {value}
    </Text>
  </Box>
);

const QuoteSummary = ({ quote, mode, taxPending }: { readonly quote: CheckoutQuoteDto; readonly mode: DeskPaymentMode; readonly taxPending: boolean }) => (
  <Box bgColor={{ color: 'surface', intensity: 200 }} padding={{ base: 16 }} flex={{ direction: 'col', gap: 4 }} className="rounded-md">
    <SummaryRow label="Subtotal" value={formatMoney(quote.subtotalCents, quote.currency)} />
    {quote.discountCents > 0 ? (
      <SummaryRow label={`Discount${quote.discount ? ` (${quote.discount.code})` : ''}`} value={`-${formatMoney(quote.discountCents, quote.currency)}`} />
    ) : null}
    {mode === 'card' ? (
      <SummaryRow label="Tax" value={taxPending ? 'Enter the billing address' : formatMoney(quote.taxCents, quote.currency)} />
    ) : null}
    <Divider color={{ color: 'surface', intensity: 300 }} />
    <SummaryRow label={mode === 'card' ? 'Charged to the card now' : 'Added to the account now'} value={formatMoney(quote.totalCents, quote.currency)} strong />
    {quote.recurring.map((charge) => (
      <Text key={charge.firstBillingAt} as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        {`Then ${formatMoney(charge.amountCents, quote.currency)} on the 1st of each month${
          mode === 'card' ? ' on this card' : ', posted to the account'
        }${charge.endsAt ? ` until ${new Date(charge.endsAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : ''}.`}
      </Text>
    ))}
  </Box>
);

interface ConfirmationProps {
  readonly account: DeskAccountDetailDto;
  readonly result: DeskOrderResultDto;
  readonly onSameFamily: () => void;
  readonly onNewFamily: () => void;
}

const Confirmation = ({ account, result, onSameFamily, onNewFamily }: ConfirmationProps) => {
  const currentUser = useCmsCurrentUser();
  const canManageLedger = canAccessCmsResource(currentUser, 'ledger:manage');
  const canManageOrders = canAccessCmsResource(currentUser, 'ecommerce:manage-orders');
  const { order } = result;
  const name = personName(account);
  const isLedger = order.paymentProvider === 'ledger';

  return (
    <Box flex={{ direction: 'col', gap: 16 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 24 }} className="rounded-lg border">
      <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-semibold">
        {result.status === 'processing' ? 'Payment processing' : `${name} is registered`}
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 800 }}>
        {result.status === 'processing'
          ? 'The card payment is still settling. The registration completes automatically once it clears.'
          : isLedger
            ? `${formatMoney(order.totals.totalCents, order.currency)} was added to the family’s account. Monthly classes post their tuition there on the 1st of each month.`
            : `${formatMoney(order.totals.totalCents, order.currency)} was charged to the card.`}
      </Text>
      {order.fulfillmentErrors.length > 0 ? (
        <Box bgColor={{ color: 'red', intensity: 100 }} padding={{ base: 12 }} className="rounded">
          {order.fulfillmentErrors.map((message) => (
            <Text key={message} as="p" textColor={{ color: 'red', intensity: 800 }} className="text-sm">
              {message}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
        <Button variant={{ kind: 'outlined', color: 'primary' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => openAccountRegistrations(account.id, name)}>
          View registrations
        </Button>
        {canManageLedger ? (
          <Button variant={{ kind: 'outlined', color: 'primary' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => openAccountLedger(account.id, name)}>
            Open account ledger
          </Button>
        ) : null}
        {canManageOrders ? (
          <Button
            variant={{ kind: 'outlined', color: 'primary' }}
            textColor={{ color: 'surface', intensity: 900 }}
            onClick={() => dialog.show(() => <OrderAdminDetail orderId={order.id} canManageLedger={canManageLedger} />, { title: 'Order', width: DIALOG_WIDTH_WIDE })}
          >
            Open order
          </Button>
        ) : null}
      </Box>
      <Divider color={{ color: 'surface', intensity: 200 }} />
      <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={onSameFamily}>
          Register more for this family
        </Button>
        <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={onNewFamily}>
          Start with another family
        </Button>
      </Box>
    </Box>
  );
};

export const DeskRegistrationModule = () => {
  const currency = useStoreCurrency();
  const paymentRef = useRef<PaymentFieldsHandle>(null);
  const [quoteDeskOrder] = useQuoteDeskOrderMutation();
  const [createDeskOrder] = useCreateDeskOrderMutation();
  const [confirmDeskOrderPayment] = useConfirmDeskOrderPaymentMutation();

  const [accountId, setAccountId] = useState<string | null>(null);
  const { data: account } = useGetDeskAccountQuery(accountId ?? '', { skip: !accountId });
  const [lines, setLines] = useState<DeskLine[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  const [mode, setMode] = useState<DeskPaymentMode>('in_person');
  const [billingAddress, setBillingAddress] = useState<PostalAddressInput>(emptyAddress);
  const [record, setRecord] = useState<DeskRecordDraft>(emptyRecord);
  const [consent, setConsent] = useState<DeskConsentDraft>(emptyConsent);
  const [quoted, setQuoted] = useState<DeskQuoteDto | null>(null);
  const [quoteError, setQuoteError] = useState<string | undefined>(undefined);
  const [lineErrors, setLineErrors] = useState<Map<string, string>>(new Map());
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DeskOrderResultDto | null>(null);

  const billingPayload = mode === 'card' ? toAddressPayload(billingAddress) : undefined;
  const code = useDebounced(discountCode.trim(), QUOTE_DEBOUNCE_MS);

  const quoteInput = useMemo((): DeskQuoteInput | null => {
    if (!accountId || lines.length === 0) return null;
    return {
      customerUserId: accountId,
      lines: lines.map((line) => line.input),
      ...(code ? { discountCode: code } : {}),
      ...(billingPayload ? { billingAddress: billingPayload } : {}),
    };
    // billingPayload is rebuilt each render; its JSON is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, lines, code, JSON.stringify(billingPayload)]);

  const quoteKey = useDebounced(quoteInput ? JSON.stringify(quoteInput) : '', QUOTE_DEBOUNCE_MS);
  useEffect(() => {
    if (!quoteKey) {
      setQuoted(null);
      setQuoteError(undefined);
      setLineErrors(new Map());
      return;
    }
    const input = JSON.parse(quoteKey) as DeskQuoteInput;
    let cancelled = false;
    quoteDeskOrder(input)
      .unwrap()
      .then((next) => {
        if (cancelled) return;
        setQuoted(next);
        setQuoteError(undefined);
        setLineErrors(new Map());
      })
      .catch((failure) => {
        if (cancelled) return;
        const info = readApiError(failure, 'This registration can’t be priced.');
        const problems = (info.details?.['lines'] as { index: number; reason: string }[] | undefined) ?? [];
        setQuoted(null);
        setQuoteError(info.message);
        setLineErrors(new Map(problems.flatMap((problem) => (lines[problem.index] ? [[lines[problem.index]!.key, problem.reason] as const] : []))));
      });
    return () => {
      cancelled = true;
    };
    // lines is read only to label errors; quoteKey already changes whenever they do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, quoteNonce, quoteDeskOrder]);

  const resetOrder = () => {
    setLines([]);
    setDiscountCode('');
    setRecord(emptyRecord);
    setConsent(emptyConsent);
    setBillingAddress(emptyAddress);
    setQuoted(null);
    setShowErrors(false);
    setResult(null);
  };

  const selectAccount = (id: string | null) => {
    resetOrder();
    setAccountId(id);
  };

  const policy = quoted?.policy;
  const quote = quoted?.quote ?? null;
  const hasRecurring = quoted?.hasRecurring ?? false;
  const taxPending = mode === 'card' && !billingPayload;

  const buildPayment = (paymentToken: string | undefined): DeskPaymentInput | string => {
    if (mode === 'card') {
      if (!billingPayload) return 'Enter the card’s billing address.';
      return { mode: 'card', billingAddress: billingPayload, expectedTotalCents: quote?.totalCents ?? 0, ...(paymentToken ? { paymentToken } : {}) };
    }
    if (!record.enabled) return { mode: 'in_person' };
    const amountCents = parseMinorUnitsInput(record.amount, currency);
    if (!amountCents || amountCents <= 0) return 'Enter the amount of the payment taken now.';
    if (record.method === 'check' && !record.checkNumber.trim()) return 'Enter the check number.';
    return {
      mode: 'in_person',
      record: { method: record.method, amountCents, ...(record.checkNumber.trim() ? { checkNumber: record.checkNumber.trim() } : {}) },
    };
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!account || !quote || !quoteInput) {
      alert.danger(quoteError ?? 'Add at least one item and wait for the total.', { position: ALERT_POSITION });
      return;
    }
    const consentError = validateDeskConsent(policy, consent);
    const precheck = buildPayment(undefined);
    if (consentError || typeof precheck === 'string') {
      alert.danger(consentError ?? (precheck as string), { position: ALERT_POSITION });
      return;
    }
    const chargesCard = mode === 'card' && quote.totalCents > 0;
    if (chargesCard) {
      const cardError = paymentRef.current ? await paymentRef.current.validate() : 'Card payments aren’t available.';
      if (cardError) {
        alert.danger(cardError, { position: ALERT_POSITION });
        return;
      }
    }

    setIsSubmitting(true);
    let pendingOrderId: string | null = null;
    try {
      const paymentToken = chargesCard && billingPayload
        ? await paymentRef.current!.createPaymentToken({
            ...(billingPayload.name ? { name: billingPayload.name } : {}),
            email: account.email,
            address: billingPayload,
          })
        : undefined;
      const payment = buildPayment(paymentToken) as DeskPaymentInput;
      const input: DeskOrderInput = {
        ...quoteInput,
        payment,
        ...(policy?.required ? { consent: { method: consent.method, signedName: consent.signedName.trim(), versionHash: policy.versionHash } } : {}),
      };

      let placed = await createDeskOrder(input).unwrap();
      if (placed.status === 'requires_action') {
        pendingOrderId = placed.order.id;
        await paymentRef.current!.handleNextAction(placed.clientSecret);
        placed = await confirmDeskOrderPayment(placed.order.id).unwrap();
      }
      setResult(placed);
    } catch (error) {
      // A bank verification the family didn't finish: let the API settle that order so its seats
      // are released before trying again.
      if (pendingOrderId) await confirmDeskOrderPayment(pendingOrderId).unwrap().catch(() => undefined);
      if (error instanceof Error) {
        alert.danger(error.message, { position: ALERT_POSITION });
        return;
      }
      const info = readApiError(error, 'This registration could not be completed.');
      const changedQuote = info.details?.['quote'] as CheckoutQuoteDto | undefined;
      if (info.status === 409 && changedQuote && quoted) {
        setQuoted({ ...quoted, quote: changedQuote });
        alert.info('The total changed. Please review it before charging the card.', { position: ALERT_POSITION });
        return;
      }
      if (info.code === POLICY_VERSION_CHANGED || info.code === POLICY_CONSENT_REQUIRED) setQuoteNonce((nonce) => nonce + 1);
      alert.danger(info.message, { position: ALERT_POSITION });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (account && result) {
    return (
      <Confirmation
        account={account}
        result={result}
        onSameFamily={resetOrder}
        onNewFamily={() => selectAccount(null)}
      />
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }} className="max-w-4xl">
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Front Desk Registration
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          Register a family in person. Classes and workshops follow the same eligibility, capacity, pricing and policy rules as online.
        </Text>
      </Box>

      <Section step={1} title="Account">
        <AccountSection account={account} onSelect={selectAccount} />
      </Section>

      {account ? (
        <>
          <Section step={2} title="Students">
            <StudentsSection account={account} />
          </Section>

          <Section step={3} title="Classes and workshops">
            <ItemsSection
              account={account}
              currency={currency}
              lines={lines}
              lineErrors={lineErrors}
              onAdd={(line) => setLines([...lines, line])}
              onRemove={(key) => setLines(lines.filter((line) => line.key !== key))}
            />
            <Input label="Promo code" value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} className="max-w-xs" />
          </Section>

          <Section step={4} title="Studio policies">
            <PolicySection policy={policy} value={consent} onChange={setConsent} showErrors={showErrors} />
          </Section>

          <Section step={5} title="Payment">
            <PaymentSection
              mode={mode}
              onModeChange={setMode}
              billingAddress={billingAddress}
              onBillingAddressChange={setBillingAddress}
              record={record}
              onRecordChange={setRecord}
              paymentRef={paymentRef}
              amountCents={quote?.totalCents ?? 0}
              currency={currency}
              hasRecurring={hasRecurring}
            />
          </Section>

          <Section step={6} title="Review">
            {quote ? <QuoteSummary quote={quote} mode={mode} taxPending={taxPending} /> : null}
            <FormError message={quoteError} />
            <Box flex={{ direction: 'row', justify: 'end' }}>
              <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSubmitting || !quote}>
                {isSubmitting ? 'Registering…' : mode === 'card' ? 'Charge card and register' : 'Register'}
              </Button>
            </Box>
          </Section>
        </>
      ) : null}
    </Box>
  );
};
