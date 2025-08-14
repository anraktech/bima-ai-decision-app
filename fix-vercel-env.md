# 🔧 Fix Vercel Environment Variable

## Step 1: Add Stripe Key to Original Vercel Project

Go to: https://vercel.com/anraktechs-projects/bima-ai-decision-app-nzwf/settings/environment-variables

Add this environment variable:

**Name:** `VITE_STRIPE_PUBLISHABLE_KEY`
**Value:** `pk_live_51RvntgGsx0aBXRni4t9w9OpqhhLYewLFLlSVetKEo5XOabAa3BoQvtj0Lp1NaAZ3ZjnAf3vIl3m5bPvCqL6cYP1f00LczSmQtP`
**Environment:** Production

## Step 2: Redeploy

After adding the environment variable, go to the Deployments tab and click "Redeploy" on the latest deployment.

## Step 3: Test

After redeployment (takes 2-3 minutes), the payment modal should open instead of showing "Payment integration coming soon!"