import type { CmsModule } from './registry';
import { PaymentHealthModule } from './payment-health/PaymentHealthModule';

// Same access as Orders: whoever manages orders is who diagnoses payments.
const paymentHealthModule: CmsModule = {
  id: 'payment-health',
  navLabel: 'Payment Health',
  icon: 'Heartbeat',
  requiredCapability: 'ecommerce:manage-orders',
  Component: PaymentHealthModule,
};

export default paymentHealthModule;
