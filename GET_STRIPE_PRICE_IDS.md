# 🔑 Get Your Stripe Price IDs (CRITICAL FOR PAYMENTS TO WORK)

## 🚨 IMPORTANT: Price ID vs Product ID
**You're currently using a Product ID (`prod_SrhEurGXrG6ZB1`) but we need Price IDs (`price_xxx`)**

- ❌ **Product ID**: `prod_SrhEurGXrG6ZB1` (This is what you have)
- ✅ **Price ID**: `price_1ABC123def456` (This is what we need)

## 📋 Steps to Get PRICE IDs (Not Product IDs):

### 1. Go to Stripe Dashboard
- Visit: https://dashboard.stripe.com/products
- Log in to your Stripe account

### 2. Find Your Products
You should see your products like:
- Starter Pack - $19
- Professional - $49  
- Enterprise - $199

### 3. Get PRICE IDs (CRITICAL STEP)
For each product:
1. **Click on the product name** (like "Starter Pack")
2. **Look for the "Pricing" section**
3. **Find the Price ID** that starts with `price_` (NOT `prod_`)
4. **Copy the Price ID** (should look like: `price_1OP2QR3STUvwxYZ...`)

## 🖼️ Visual Guide:

When you click on a product in Stripe Dashboard, you'll see:

```
Product Details
├── Product ID: prod_SrhEurGXrG6ZB1  ← ❌ DON'T USE THIS
└── Pricing
    ├── Default Price: $19.00 USD
    └── Price ID: price_1OP2QR3STUvwxYZ  ← ✅ USE THIS!
```

### 4. Update Your Environment Variables

Replace the Product ID (`prod_SrhEurGXrG6ZB1`) with the actual **Price IDs**:

```bash
# Replace these with PRICE IDs (starting with price_) NOT Product IDs
STRIPE_STARTER_PRICE_ID=price_1OP2QR3STUvwxYZ      # ✅ Starts with price_
STRIPE_PROFESSIONAL_PRICE_ID=price_1ABC123def456   # ✅ Starts with price_
STRIPE_ENTERPRISE_PRICE_ID=price_1XYZ789ghi012     # ✅ Starts with price_
```

### 5. Deploy to Railway
After updating the `.env` file, make sure to:
1. Update environment variables on Railway with the real Price IDs
2. Redeploy your backend

## 🎯 Example of What Price IDs Look Like:
- ✅ Correct: `price_1OP2QR3STUvwxYZaBcDeFgHi`
- ❌ Wrong: `price_starter_monthly_id_here`

## 🔍 How to Find the Right Price IDs:
- Look for products with the exact same prices as your working payment link
- Make sure they're monthly recurring or one-time payments (depending on your setup)
- The Price IDs should be for USD currency

Once you update these, your Stripe payments will work exactly like your payment link! 🚀