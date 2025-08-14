# 🎯 Exact Stripe Products Setup Instructions

## Step 1: Create Products in Stripe Dashboard

Go to: https://dashboard.stripe.com/products

Click **"+ Add product"** for each of these:

### Product 1: BIMA Starter Pack
1. **Product information**:
   - Name: `BIMA Starter Pack`
   - Description: `250,000 tokens per month with priority processing`
   
2. **Pricing**:
   - Pricing model: `Standard pricing`
   - Price: `19.00`
   - Currency: `USD`
   - Billing period: `Monthly`
   
3. Click **"Add product"**
4. **COPY THE PRICE ID** (looks like: `price_1QXyzABC...`)

### Product 2: BIMA Professional
1. **Product information**:
   - Name: `BIMA Professional`
   - Description: `750,000 tokens per month with advanced features`
   
2. **Pricing**:
   - Pricing model: `Standard pricing`
   - Price: `49.00`
   - Currency: `USD`
   - Billing period: `Monthly`
   
3. Click **"Add product"**
4. **COPY THE PRICE ID**

### Product 3: BIMA Enterprise
1. **Product information**:
   - Name: `BIMA Enterprise`
   - Description: `3,000,000 tokens per month with team management`
   
2. **Pricing**:
   - Pricing model: `Standard pricing`
   - Price: `199.00`
   - Currency: `USD`
   - Billing period: `Monthly`
   
3. Click **"Add product"**
4. **COPY THE PRICE ID**

---

## Step 2: Update Railway Environment Variables

Go to your Railway project dashboard and update these:

```
STRIPE_STARTER_PRICE_ID=[paste price ID from step 1]
STRIPE_PROFESSIONAL_PRICE_ID=[paste price ID from step 1]
STRIPE_ENTERPRISE_PRICE_ID=[paste price ID from step 1]
```

---

## Step 3: Setup Webhook

Go to: https://dashboard.stripe.com/webhooks

1. Click **"Add endpoint"**
2. **Endpoint URL**: 
   ```
   https://bima-ai-decision-app-production.up.railway.app/api/stripe/webhook
   ```
3. **Description**: `Railway Production Webhook`
4. **Events to send** - Select these:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

5. Click **"Add endpoint"**
6. **COPY THE SIGNING SECRET** (starts with `whsec_`)
7. Update in Railway: `STRIPE_WEBHOOK_SECRET=[paste signing secret]`

---

## Step 4: Enable Customer Portal

Go to: https://dashboard.stripe.com/settings/billing/portal

1. Click **"Activate customer portal"**
2. **Features** - Enable all:
   - ✅ Customers can update payment methods
   - ✅ Customers can update subscriptions
   - ✅ Customers can cancel subscriptions
   - ✅ Customers can view invoice history

3. **Business information**:
   - Business name: `BIMA AI`
   - Support email: [your email]
   - Support URL: `https://ai-decision-6w766plre-anraktechs-projects.vercel.app`

4. Click **"Save"**

---

## Step 5: Deploy to Railway

Run these commands in terminal:

```bash
# Set the token
export RAILWAY_TOKEN=4e5caf6e-03eb-4578-a5e9-0558dced4f73

# Deploy
railway up

# If it asks for service, try:
railway up --service [service-name]
```

---

## Step 6: Test Your Integration

1. Visit: https://ai-decision-6w766plre-anraktechs-projects.vercel.app
2. Go to Billing page
3. Try upgrading to Starter plan
4. Use test card: `4242 4242 4242 4242`
5. Check Stripe Dashboard for the payment

---

## 🎉 That's it!

Your Stripe integration will be fully live once you complete these steps!