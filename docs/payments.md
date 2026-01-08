# Payments

This project supports three billing models:

- `subscription` / `one_time` via Stripe Checkout
- `per_course` via Stripe Checkout or PayPal Orders

Payment configuration is stored in Firestore at `settings/payment` and managed in the UI at `/admin/payment`.

## Environment variables

Server-side billing APIs require these env vars:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_ENV` (`sandbox` or `live`)
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID` (for PayPal webhooks)

See `.env.example` and `.env.local.example`.

## PayPal webhook (optional, recommended)

Endpoint: `/api/billing/paypal-webhook`

- This endpoint verifies the webhook signature using PayPal’s `verify-webhook-signature` API and `PAYPAL_WEBHOOK_ID`.
- For local development, PayPal cannot call `localhost`; use a public HTTPS URL (e.g. ngrok) and point the webhook to `https://<your-domain>/api/billing/paypal-webhook`.

## Offline / local payments (cash/waived)

Admins can record offline payments per student per course:

1. Go to `/admin/access`
2. Find the student
3. Click `Offline payment`
4. Select a course and choose `Cash`, `Local payment`, or `Waived`
5. Save

This creates/updates a document at:

- `users/{studentId}/coursePurchases/{courseId}`

The existence of that doc unlocks the course content for the student (assuming they enroll in the course).

