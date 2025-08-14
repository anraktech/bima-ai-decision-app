# Stripe Webhook Configuration

## Setup Webhook Endpoint

### 1. Add Webhook in Stripe Dashboard
**Navigation:** Developers → Webhooks → Add endpoint

**Endpoint URL:** 
- **Local Testing:** Use ngrok: `https://your-ngrok-url.ngrok.io/api/stripe/webhook`
- **Production:** `https://your-railway-domain.railway.app/api/stripe/webhook`

### 2. Select Events to Send
Add these specific events:

✅ **customer.subscription.created**
✅ **customer.subscription.updated** 
✅ **customer.subscription.deleted**
✅ **invoice.payment_succeeded**
✅ **invoice.payment_failed**

### 3. Get Webhook Secret
After creating the webhook:
1. Click on your webhook endpoint
2. Click "Reveal" next to "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Add to your .env: `STRIPE_WEBHOOK_SECRET=whsec_your_secret`

## Local Testing with ngrok

1. Install ngrok: `npm install -g ngrok`
2. Start your local server: `npm run dev` (port 3001)
3. In another terminal: `ngrok http 3001`
4. Copy the https URL and use as webhook endpoint
5. Test webhooks locally before deploying

## Webhook Events We Handle

- **subscription.created/updated** → Updates local subscription data
- **subscription.deleted** → Marks subscription as cancelled  
- **payment_succeeded** → Logs successful payment
- **payment_failed** → Handles failed payments

## Testing Webhooks

Use Stripe CLI for testing:
```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
stripe trigger customer.subscription.created
```