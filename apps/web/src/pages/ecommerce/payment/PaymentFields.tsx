import { forwardRef } from 'react';
import { Text } from '@inithium/ui';
import type { PaymentFieldsHandle, PaymentFieldsProps } from './payment-fields.contract';
import { StripePaymentFields } from './StripePaymentFields';

interface ProviderPaymentFieldsProps extends PaymentFieldsProps {
  // From GET /api/store/config - which provider the API is configured with.
  readonly provider: string;
}

// Picks the payment fields matching the API's active payment provider.
export const PaymentFields = forwardRef<PaymentFieldsHandle, ProviderPaymentFieldsProps>(({ provider, ...props }, ref) => {
  switch (provider) {
    case 'stripe':
      return <StripePaymentFields ref={ref} {...props} />;
    default:
      return (
        <Text as="p" textColor={{ color: 'surface', intensity: 800 }}>
          {`Payments aren't available right now (unsupported provider "${provider}").`}
        </Text>
      );
  }
});
PaymentFields.displayName = 'PaymentFields';
