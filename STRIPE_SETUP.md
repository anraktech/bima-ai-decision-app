# Stripe Payment Integration Setup

## Overview
The BIMA AI Decision App now includes a complete Stripe payment integration for subscription billing with automated usage tracking and limit enforcement.

## Required Environment Variables

### Backend (.env)
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...             # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...           # Webhook endpoint secret from Stripe
STRIPE_STARTER_PRICE_ID=price_...         # Stripe Price ID for Starter plan ($19/month)
STRIPE_PROFESSIONAL_PRICE_ID=price_...    # Stripe Price ID for Professional plan ($49/month)
STRIPE_ENTERPRISE_PRICE_ID=price_...      # Stripe Price ID for Enterprise plan ($199/month)

# Client URL for Stripe redirects
CLIENT_URL=https://your-frontend-domain.vercel.app
```

### Frontend (.env)
```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...   # Your Stripe publishable key
```

## Stripe Dashboard Setup

### 1. Create Products and Prices
Create the following products in your Stripe dashboard:

**Starter Pack**
- Product Name: "BIMA Starter Pack"
- Price: $19.00 USD
- Billing: Monthly recurring
- Copy the Price ID to `STRIPE_STARTER_PRICE_ID`

**Professional**
- Product Name: "BIMA Professional"
- Price: $49.00 USD
- Billing: Monthly recurring
- Copy the Price ID to `STRIPE_PROFESSIONAL_PRICE_ID`

**Enterprise**
- Product Name: "BIMA Enterprise"
- Price: $199.00 USD
- Billing: Monthly recurring
- Copy the Price ID to `STRIPE_ENTERPRISE_PRICE_ID`

### 2. Configure Webhooks
Add a webhook endpoint in Stripe Dashboard:

**Endpoint URL:** `https://your-backend-domain.railway.app/api/stripe/webhook`

**Events to send:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

### 3. Enable Customer Portal
Go to Settings > Billing > Customer portal and configure:
- Enable all features (subscription management, payment methods, etc.)
- Set business information
- Configure allowed actions

## Features Implemented

### 📱 **Frontend Features**
✅ **Enhanced Billing Page**
- Real-time subscription status display
- Current usage visualization with progress bars
- Plan comparison with feature matrix
- Integrated Stripe payment modal
- Stripe Customer Portal access

✅ **Payment Modal**
- Secure Stripe Elements integration
- Real-time payment processing
- Success/error handling with proper UI feedback
- Automatic subscription activation

✅ **Usage Limit Enforcement**
- Popup notifications when approaching limits (95% and 100%)
- Real-time monitoring during conversations
- Integrated across all conversation modes

### 🔧 **Backend Features**
✅ **Stripe API Integration**
- Customer creation and management
- Payment intent processing
- Subscription lifecycle management
- Secure webhook handling with signature verification

✅ **Database Management**
- Comprehensive subscription tables
- Usage period tracking
- Renewal history logging
- Automatic migrations for existing users

✅ **Webhook Processing**
- Subscription creation/updates
- Payment success/failure handling
- Automatic plan changes
- Local database synchronization

## API Endpoints

### Subscription Management
- `GET /api/subscription` - Get current subscription
- `POST /api/subscription/upgrade` - Upgrade plan
- `POST /api/subscription/renew` - Renew subscription
- `GET /api/subscription/history` - Get subscription history
- `GET /api/subscription/check-renewal` - Check renewal status

### Stripe Integration
- `POST /api/stripe/create-customer` - Create Stripe customer
- `POST /api/stripe/create-payment-intent` - Create payment intent
- `POST /api/stripe/create-subscription` - Create Stripe subscription
- `POST /api/stripe/cancel-subscription` - Cancel subscription
- `POST /api/stripe/billing-portal` - Get billing portal URL
- `POST /api/stripe/webhook` - Handle Stripe webhooks

## Testing

### Test Cards (Stripe Test Mode)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0000 0000 3220
```

### Testing Flow
1. Create test products in Stripe Dashboard
2. Set up webhook endpoint with ngrok for local testing
3. Test payment flow with test cards
4. Verify webhook events are processed correctly
5. Check database updates and subscription status

## Deployment Notes

### Railway Backend
1. Add all Stripe environment variables
2. Deploy webhook endpoint
3. Update Stripe webhook URL to production domain

### Vercel Frontend
1. Add `VITE_STRIPE_PUBLISHABLE_KEY`
2. Deploy and test payment flow
3. Verify redirects work correctly

## Security Considerations

✅ **Implemented Security Measures**
- Webhook signature verification
- Server-side payment validation
- Secure API key handling
- Database transaction safety
- User authentication on all endpoints

## Plan Details

| Plan | Tokens/Month | Price | Features |
|------|-------------|-------|----------|
| **Explore** | 50,000 | Free | Basic access, community support |
| **Starter** | 250,000 | $19/month | Priority processing, email support |
| **Professional** | 750,000 | $49/month | Advanced analytics, API access |
| **Enterprise** | 3,000,000 | $199/month | Team management, dedicated support |

## Support

For issues with Stripe integration:
1. Check Stripe Dashboard logs
2. Review webhook delivery attempts
3. Verify environment variables
4. Check server logs for payment processing errors
5. Test with Stripe CLI for local development

The integration is production-ready with comprehensive error handling, webhook processing, and automated subscription management.