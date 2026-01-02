export type PaymentProvider = 'stripe' | 'paypal';
export type PaymentModel = 'subscription' | 'one_time' | 'per_course';
export type PaymentCurrency = 'CAD' | 'USD';
export type PaymentInterval = 'month' | 'year';
export type PaymentPlanId = 'basic' | 'pro' | 'enterprise';

export type StripePlanPrices = {
  monthlyPriceId: string;
  yearlyPriceId: string;
  oneTimePriceId: string;
};

export type PaymentPlanSettings = {
  enabled: boolean;
  /** When true, the UI should show a "Contact us" flow instead of Stripe checkout. */
  contactOnly: boolean;
  stripe: StripePlanPrices;
};

export type PaymentSettings = {
  /** Global switch for payments UI/flows. */
  enabled: boolean;
  provider: PaymentProvider;
  model: PaymentModel;
  currency: PaymentCurrency;
  intervals: {
    month: boolean;
    year: boolean;
    default: PaymentInterval;
  };
  /**
   * Controls whether students are blocked by `users/{uid}.requirePayment`.
   * Note: Enforcement requires `firestore.rules` to read this setting.
   */
  paywall: {
    enabled: boolean;
    /**
     * When true, new students are treated as requiring payment unless their user doc
     * explicitly sets `requirePayment === false`.
     */
    defaultRequirePayment: boolean;
  };
  plans: Record<PaymentPlanId, PaymentPlanSettings>;
  enterpriseContact: {
    email: string;
    url: string;
  };
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  enabled: false,
  provider: 'stripe',
  model: 'subscription',
  currency: 'CAD',
  intervals: {
    month: true,
    year: true,
    default: 'month',
  },
  paywall: {
    enabled: false,
    defaultRequirePayment: false,
  },
  plans: {
    basic: {
      enabled: true,
      contactOnly: false,
      stripe: { monthlyPriceId: '', yearlyPriceId: '', oneTimePriceId: '' },
    },
    pro: {
      enabled: true,
      contactOnly: false,
      stripe: { monthlyPriceId: '', yearlyPriceId: '', oneTimePriceId: '' },
    },
    enterprise: {
      enabled: true,
      contactOnly: true,
      stripe: { monthlyPriceId: '', yearlyPriceId: '', oneTimePriceId: '' },
    },
  },
  enterpriseContact: {
    email: '',
    url: '',
  },
};

function asString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function asBool(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback;
}

export function sanitizePaymentSettings(
  input: unknown,
  fallback: PaymentSettings = DEFAULT_PAYMENT_SETTINGS,
): PaymentSettings {
  const raw = (input || {}) as Partial<PaymentSettings> & Record<string, unknown>;

  const provider: PaymentProvider =
    raw.provider === 'paypal' || raw.provider === 'stripe'
      ? raw.provider
      : fallback.provider;

  const model: PaymentModel =
    raw.model === 'one_time' || raw.model === 'subscription' || raw.model === 'per_course'
      ? raw.model
      : fallback.model;

  const currency: PaymentCurrency =
    raw.currency === 'USD' || raw.currency === 'CAD' ? raw.currency : fallback.currency;

  const intervalsRaw = (raw.intervals || {}) as any;
  const monthEnabled = asBool(intervalsRaw.month, fallback.intervals.month);
  const yearEnabled = asBool(intervalsRaw.year, fallback.intervals.year);
  const defaultIntervalRaw = intervalsRaw.default;
  const defaultInterval: PaymentInterval =
    defaultIntervalRaw === 'year' || defaultIntervalRaw === 'month'
      ? defaultIntervalRaw
      : fallback.intervals.default;

  const paywallRaw = (raw.paywall || {}) as any;
  const paywallEnabled = asBool(paywallRaw.enabled, fallback.paywall.enabled);
  const defaultRequirePayment = asBool(
    paywallRaw.defaultRequirePayment,
    fallback.paywall.defaultRequirePayment,
  );

  const plansRaw = (raw.plans || {}) as any;
  const plans: Record<PaymentPlanId, PaymentPlanSettings> = { ...fallback.plans };
  (Object.keys(plans) as PaymentPlanId[]).forEach((planId) => {
    const fbPlan = fallback.plans[planId];
    const rp = plansRaw?.[planId] || {};
    const stripeRaw = rp?.stripe || {};
    plans[planId] = {
      enabled: asBool(rp?.enabled, fbPlan.enabled),
      contactOnly: asBool(rp?.contactOnly, fbPlan.contactOnly),
      stripe: {
        monthlyPriceId: asString(stripeRaw?.monthlyPriceId || fbPlan.stripe.monthlyPriceId).trim(),
        yearlyPriceId: asString(stripeRaw?.yearlyPriceId || fbPlan.stripe.yearlyPriceId).trim(),
        oneTimePriceId: asString(stripeRaw?.oneTimePriceId || fbPlan.stripe.oneTimePriceId).trim(),
      },
    };
  });

  const enterpriseContactRaw = (raw.enterpriseContact || {}) as any;
  const enterpriseContact = {
    email: asString(enterpriseContactRaw.email || fallback.enterpriseContact.email).trim(),
    url: asString(enterpriseContactRaw.url || fallback.enterpriseContact.url).trim(),
  };

  const enabled = asBool(raw.enabled, fallback.enabled);

  return {
    enabled,
    provider,
    model,
    currency,
    intervals: { month: monthEnabled, year: yearEnabled, default: defaultInterval },
    paywall: { enabled: paywallEnabled, defaultRequirePayment },
    plans,
    enterpriseContact,
  };
}

export function getStripePriceId(
  settings: PaymentSettings,
  planId: PaymentPlanId,
  interval: PaymentInterval,
): string | null {
  const plan = settings.plans[planId];
  if (!plan?.enabled || plan.contactOnly) return null;

  if (settings.model === 'one_time') {
    const id = plan.stripe.oneTimePriceId?.trim();
    return id || null;
  }

  const id =
    interval === 'year'
      ? plan.stripe.yearlyPriceId?.trim()
      : plan.stripe.monthlyPriceId?.trim();
  return id || null;
}

export function getPlanCheckoutKind(settings: PaymentSettings, planId: PaymentPlanId) {
  const plan = settings.plans[planId];
  if (!plan?.enabled) return 'disabled' as const;
  if (plan.contactOnly) return 'contact' as const;
  if (settings.provider !== 'stripe') return 'unsupported' as const;
  return 'stripe' as const;
}
