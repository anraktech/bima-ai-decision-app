# 🔑 Get Your Stripe Price IDs (CRITICAL FOR PAYMENTS TO WORK)

## Why This Is Needed
Since your Stripe payment link works, you have proper products set up in Stripe. Our code needs to use the **same Price IDs** that your working payment link uses.

## 📋 Steps to Get Price IDs:

### 1. Go to Stripe Dashboard
- Visit: https://dashboard.stripe.com/products
- Log in to your Stripe account

### 2. Find Your Products
You should see your products like:
- Starter Pack - $19
- Professional - $49  
- Enterprise - $199

### 3. Get Price IDs
For each product:
1. Click on the product name
2. Look for the Price ID (starts with `price_`)
3. Copy the Price ID

### 4. Update Your Environment Variables

Replace these placeholder values in your `.env` file:

```bash
# Replace these with your actual Price IDs from Stripe Dashboard
STRIPE_STARTER_PRICE_ID=price_1ABC123def456      # Replace with actual ID
STRIPE_PROFESSIONAL_PRICE_ID=price_1XYZ789ghi012  # Replace with actual ID  
STRIPE_ENTERPRISE_PRICE_ID=price_1QRS456jkl789    # Replace with actual ID
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