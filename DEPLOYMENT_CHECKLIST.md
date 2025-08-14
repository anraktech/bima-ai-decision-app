# 🚀 DEPLOYMENT CHECKLIST FOR STRIPE PAYMENTS

## ✅ STEP 1: RAILWAY BACKEND CONFIGURATION

### Go to Railway Dashboard → Your Backend Service → Variables Tab

Add these environment variables:

```bash
STRIPE_SECRET_KEY=[your_stripe_secret_key_from_env_file]
STRIPE_STARTER_PRICE_ID=price_1RvxppGsx0aBXRniq5NKm5Qr
STRIPE_PROFESSIONAL_PRICE_ID=price_1RvxqZGsx0aBXRnigushZH3c
STRIPE_ENTERPRISE_PRICE_ID=price_1RvxrKGsx0aBXRniLjbyekUZ
CLIENT_URL=https://anrak.tech
JWT_SECRET=your-secret-key-change-this-in-production-123456789
```

### Get Webhook Secret from Stripe:
1. Go to https://dashboard.stripe.com/webhooks
2. Create webhook endpoint: `https://bima-ai-decision-app-production.up.railway.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
4. Copy the signing secret (starts with `whsec_`)
5. Add to Railway:
```bash
STRIPE_WEBHOOK_SECRET=whsec_[your_actual_secret_here]
```

## ✅ STEP 2: VERCEL FRONTEND CONFIGURATION

### Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these environment variables:

```bash
VITE_API_URL=https://bima-ai-decision-app-production.up.railway.app
VITE_STRIPE_PUBLISHABLE_KEY=[your_stripe_publishable_key_from_env_file]
```

### After adding variables:
1. Go to Deployments tab
2. Click on the latest deployment
3. Click "Redeploy" → "Redeploy with existing Build Cache"

## ✅ STEP 3: VERIFY DEPLOYMENTS

### Test Railway Backend:
```bash
curl -X POST https://bima-ai-decision-app-production.up.railway.app/api/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "planType": "starter",
    "userEmail": "test@example.com",
    "userName": "Test User",
    "userId": 1,
    "successUrl": "https://anrak.tech/dashboard?payment=success",
    "cancelUrl": "https://anrak.tech/dashboard?payment=cancelled"
  }'
```
Should return: `{"url":"https://checkout.stripe.com/...","session_id":"cs_live_..."}`

### Test Vercel Frontend:
1. Go to https://anrak.tech
2. Open browser console (F12)
3. Run:
```javascript
fetch('https://bima-ai-decision-app-production.up.railway.app/api/stripe/create-checkout-session', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    planType: 'starter',
    userEmail: 'test@example.com',
    userName: 'Test',
    userId: 1
  })
}).then(r => r.json()).then(console.log)
```
Should show checkout URL in console.

## ✅ STEP 4: FULL END-TO-END TEST

1. Login to your app at https://anrak.tech
2. Click "Upgrade" on any plan
3. You should be redirected to Stripe Checkout
4. Enter test card: `4242 4242 4242 4242`
5. Complete payment
6. Should redirect back to dashboard with success message
7. Check Railway logs for webhook confirmation

## 🔴 TROUBLESHOOTING

### If Railway backend not working:
- Check Railway deployment logs
- Verify all environment variables are set
- Check if deployment is active

### If Vercel frontend not connecting:
- Check browser console for errors
- Verify VITE_API_URL is set correctly
- Redeploy after setting environment variables

### If Stripe checkout not loading:
- Check if Price IDs are set in Railway
- Verify Stripe account is in LIVE mode
- Check browser for ad blockers

### If webhook not working:
- Verify STRIPE_WEBHOOK_SECRET is set
- Check Stripe dashboard for webhook attempts
- Look at Railway logs for webhook errors

## ✅ WHAT'S ALREADY FIXED:
- ✅ Webhook handler bug (was updating wrong table)
- ✅ Database schema alignment
- ✅ Checkout session creation
- ✅ KAPIL12 coupon validation
- ✅ Price IDs configured correctly

## 📝 NOTES:
- Railway auto-deploys from GitHub pushes
- Vercel needs manual redeploy after env var changes
- Webhook is optional (payments work without it, but no auto-upgrade)
- All Price IDs are for LIVE mode (not test mode)