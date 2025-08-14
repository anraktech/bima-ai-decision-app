# Stripe Products Setup Guide

## Create These Products in Your Stripe Dashboard

### 1. BIMA Starter Pack
**Navigation:** Products → Add Product
- **Name:** `BIMA Starter Pack`
- **Description:** `250,000 AI tokens per month with priority processing and email support`
- **Pricing Model:** `Recurring`
- **Price:** `$19.00 USD`
- **Billing Period:** `Monthly`
- **Tax Code:** `txcd_10103001` (Software as a Service)

**After creation, copy the Price ID (starts with `price_`) → This goes in `STRIPE_STARTER_PRICE_ID`**

### 2. BIMA Professional
**Navigation:** Products → Add Product
- **Name:** `BIMA Professional`
- **Description:** `750,000 AI tokens per month with advanced analytics and API access`
- **Pricing Model:** `Recurring`
- **Price:** `$49.00 USD`
- **Billing Period:** `Monthly`
- **Tax Code:** `txcd_10103001` (Software as a Service)

**After creation, copy the Price ID → This goes in `STRIPE_PROFESSIONAL_PRICE_ID`**

### 3. BIMA Enterprise
**Navigation:** Products → Add Product
- **Name:** `BIMA Enterprise`
- **Description:** `3,000,000 AI tokens per month with team management and dedicated support`
- **Pricing Model:** `Recurring`
- **Price:** `$199.00 USD`
- **Billing Period:** `Monthly`
- **Tax Code:** `txcd_10103001` (Software as a Service)

**After creation, copy the Price ID → This goes in `STRIPE_ENTERPRISE_PRICE_ID`**

## Quick Setup Commands

Once you have the Price IDs, update your .env file:

```bash
# Backend .env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_STARTER_PRICE_ID=price_your_starter_id
STRIPE_PROFESSIONAL_PRICE_ID=price_your_professional_id  
STRIPE_ENTERPRISE_PRICE_ID=price_your_enterprise_id

# Frontend .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```