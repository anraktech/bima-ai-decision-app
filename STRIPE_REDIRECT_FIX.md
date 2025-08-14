# 🚨 FIX YOUR STRIPE PAYMENT LINKS NOW!

## THE PROBLEM:
Your payment links work but DON'T REDIRECT BACK to your website after payment!

## THE SOLUTION:

### Go to Stripe Dashboard: https://dashboard.stripe.com/payment-links

### For STARTER Link:
1. Find "STARTER" payment link
2. Click the "..." menu → Edit
3. Scroll to "After payment" section
4. Select: **"Don't show confirmation page"**
5. Enter redirect URL:
   ```
   https://anrak.tech/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}
   ```
6. Save

### For PROFESSIONAL Link:
1. Find "PROFESSIONAL" payment link
2. Click the "..." menu → Edit
3. Scroll to "After payment" section
4. Select: **"Don't show confirmation page"**
5. Enter redirect URL:
   ```
   https://anrak.tech/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}
   ```
6. Save

### For ENTERPRISE Link:
1. Find "BIMA ENTERPRISE" payment link
2. Click the "..." menu → Edit
3. Scroll to "After payment" section
4. Select: **"Don't show confirmation page"**
5. Enter redirect URL:
   ```
   https://anrak.tech/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}
   ```
6. Save

## IMPORTANT NOTES:

- The `{CHECKOUT_SESSION_ID}` part is LITERAL - Stripe will replace it automatically
- Make sure URL is EXACTLY: `https://anrak.tech/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`
- This tells Stripe where to send users after payment
- Without this, payments work but users get stuck on Stripe's page!

## TEST AFTER CONFIGURATION:

1. Go to https://anrak.tech/billing
2. Click upgrade on any plan
3. Complete payment
4. Should redirect back to your dashboard
5. Dashboard will show "Payment Successful!"
6. User subscription will be updated

## WHY IT WASN'T WORKING:

- Payment was completing ✅
- But Stripe didn't know where to redirect ❌
- Now it will redirect to your dashboard ✅
- Dashboard will verify the session and update subscription ✅

**DO THIS NOW - IT'S THE ONLY THING MISSING!**