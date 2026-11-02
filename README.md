This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Top-up balances and bundle history

The dashboard shows the carrier's combined remaining DATA balance and lists confirmed purchases, customer top-ups and admin top-ups for the selected number. It does not add purchased package sizes to a balance that already includes those packages. Each bundle keeps its own expiry date; historical expired packages remain visible without increasing the active purchased allowance.

Recharge confirmation emails open the dashboard with `await_balance=1` and `msisdn`. These parameters survive login. Once authenticated, the dashboard selects that assigned number and polls for a fresh DATA balance. The balance-status API requests a carrier refresh when needed and rejects numbers outside the signed-in account. Pending and failed recharges do not appear as added bundles.

Deploy the matching API services and migrations `2026_11_02_000001_create_customer_bundle_recharges.php` and `2026_11_02_000002_add_bundle_details_to_customer_recharges.php` before deploying this dashboard. Run the frontend regression checks with `node --experimental-strip-types --test tests/bundle-topup.test.mjs`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Partner referrals

Local checkout uses the shared local API at http://127.0.0.1:8000/api. Run this shop on port 3002 while the admin and partner portals use 3000/3001. Restart after changing .env.local. Set the Laravel PARTNER_SHOP_URL to the actual shop origin when using a different port or deploying.

The /r/CODE route validates an approved partner code, saves a first-party HttpOnly referral cookie for 30 days, and redirects to /bundles. The most recent valid link/code wins before an order is created. Invalid links do not overwrite a valid saved referral. Checkout displays an optional partner-code field with Apply and Remove controls. Saved codes are checked again immediately before order creation and by Laravel at checkout. An unavailable code must be replaced or explicitly removed.

The order stores the referral ID and a code snapshot. Existing order/payment retries keep their original attribution. Referral codes do not change prices or create commissions in this feature. Codes belonging to the buyer's own partner email cannot be used for their order. No referral service receives private customer data when generating QR images.
