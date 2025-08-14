# Environment Variables Setup

Copy this to your `.env` file and fill in your Stripe keys:

```bash
# =============================================================================
# STRIPE CONFIGURATION (Required for Payment Processing)
# =============================================================================

# Get these from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Get webhook secret from: https://dashboard.stripe.com/webhooks  
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Create products in Stripe Dashboard and copy Price IDs
STRIPE_STARTER_PRICE_ID=price_your_starter_plan_id
STRIPE_PROFESSIONAL_PRICE_ID=price_your_professional_plan_id
STRIPE_ENTERPRISE_PRICE_ID=price_your_enterprise_plan_id

# Your frontend URL for Stripe redirects
CLIENT_URL=http://localhost:5173

# =============================================================================
# EXISTING CONFIGURATION (Keep your current values)
# =============================================================================

# Your existing AI API keys...
OPENAI_API_KEY=your_existing_key
ANTHROPIC_API_KEY=your_existing_key
# ... etc
```

## Quick Setup Steps:

1. **Get Stripe Keys:**
   - Go to https://dashboard.stripe.com/apikeys
   - Copy Secret Key → `STRIPE_SECRET_KEY`
   - Copy Publishable Key → `VITE_STRIPE_PUBLISHABLE_KEY`

2. **Create Products:**
   - Follow `stripe-products-setup.md`
   - Copy Price IDs to environment variables

3. **Setup Webhooks:**
   - Follow `webhook-setup.md`
   - Copy webhook secret → `STRIPE_WEBHOOK_SECRET`

4. **Test Integration:**
   - Use test cards from `payment-testing.md`
   - Verify payment flow works end-to-end