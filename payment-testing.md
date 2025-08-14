# Payment Integration Testing Guide

## Test Cards for Stripe Test Mode

### ✅ Successful Payments
```
Card Number: 4242 4242 4242 4242
CVC: Any 3 digits
Date: Any future date
```

### ❌ Declined Payments
```
Card Number: 4000 0000 0000 0002
CVC: Any 3 digits  
Date: Any future date
```

### 🔐 3D Secure Authentication
```
Card Number: 4000 0000 0000 3220
CVC: Any 3 digits
Date: Any future date
```

## Testing Workflow

### 1. Test Payment Flow
1. Go to `/billing` page
2. Click "Upgrade Now" on any paid plan
3. Enter test card details
4. Verify payment processes successfully
5. Check subscription updates in database

### 2. Test Usage Limits
1. Use the app and generate AI responses
2. Monitor usage in profile page
3. Verify usage limit popup appears at 95%
4. Test upgrade flow from the popup

### 3. Test Webhook Processing
1. Complete a payment
2. Check server logs for webhook events
3. Verify database updates
4. Test subscription status changes

### 4. Test Customer Portal
1. Complete a payment to create subscription
2. Click "Manage Billing" button
3. Verify portal opens correctly
4. Test plan changes and cancellations

## Verification Checklist

### ✅ Frontend Testing
- [ ] Billing page loads subscription data
- [ ] Payment modal opens and processes payments
- [ ] Usage visualization shows correct data
- [ ] Success/error states display properly
- [ ] Navigation flows work correctly

### ✅ Backend Testing
- [ ] API endpoints respond correctly
- [ ] Database updates happen atomically
- [ ] Webhook signature verification works
- [ ] Error handling prevents data corruption
- [ ] Usage tracking integrates with subscriptions

### ✅ Integration Testing
- [ ] End-to-end payment flow works
- [ ] Subscription upgrades activate immediately
- [ ] Usage limits trigger correctly
- [ ] Customer portal integration functions
- [ ] Webhook events sync properly

## Common Issues & Solutions

### Payment Modal Won't Open
- Check `VITE_STRIPE_PUBLISHABLE_KEY` is set
- Verify Stripe Elements are loading
- Check browser console for errors

### Webhook Events Not Processing
- Verify webhook secret is correct
- Check endpoint URL is accessible
- Ensure events are selected in Stripe Dashboard

### Subscription Not Updating
- Check database connection
- Verify authentication tokens
- Review server logs for errors

## Monitoring in Production

### Stripe Dashboard Monitoring
- **Payments** → Monitor successful/failed transactions
- **Subscriptions** → Track active/cancelled subscriptions  
- **Webhooks** → Monitor delivery success rates
- **Logs** → Debug payment issues

### Application Monitoring
- Database subscription table
- Usage tracking accuracy
- Error rates in payment processing
- User upgrade/cancellation patterns