# Stripe Customer Portal Setup

## Configure Self-Service Portal

### 1. Enable Customer Portal
**Navigation:** Settings → Billing → Customer portal

### 2. Business Information
- **Business name:** `ANRAK`
- **Support email:** `kapil@anrak.io`
- **Support phone:** `+44 7931 802822`
- **Website:** `https://your-domain.com`

### 3. Features to Enable
✅ **Subscription management**
- Allow customers to cancel subscriptions
- Allow customers to pause subscriptions
- Allow customers to switch plans

✅ **Payment methods**
- Allow customers to update payment methods
- Allow customers to add payment methods

✅ **Invoice history**
- Allow customers to view invoices
- Allow customers to download invoices

### 4. Functionality Configuration
- **Subscription cancellation:** `At period end`
- **Proration:** `Always invoice immediately`
- **Default return URL:** `https://your-frontend-domain.vercel.app/billing`

### 5. Test the Portal
Once configured, test the portal:
1. Create a test subscription
2. Use the "Manage Billing" button in your app
3. Verify all features work correctly

## Portal Features Available
- View and download invoices
- Update payment methods
- Change subscription plans
- Cancel subscriptions
- View usage and billing history
- Update billing address