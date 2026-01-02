import type { PaymentSettings } from '@/lib/payment-settings';
import type { UserProfile } from '@/types/models';

export function studentRequiresPayment(
  settings: PaymentSettings,
  userProfile: UserProfile | null | undefined,
) {
  if (!settings.paywall.enabled) return false;
  const v = userProfile?.requirePayment;
  return settings.paywall.defaultRequirePayment ? v !== false : v === true;
}

