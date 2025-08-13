# Railway Deployment Guide

This guide explains how to deploy the BIMA AI Decision App to Railway with persistent database storage.

## Important: Database Persistence Setup

The app uses SQLite for data storage. To prevent data loss during deployments, a persistent volume must be configured.

### Steps to Deploy with Persistent Storage:

1. **Create a Railway Project**
   - Connect your GitHub repository to Railway
   - Railway will detect the `railway.json` configuration

2. **Create a Persistent Volume**
   - In Railway dashboard, go to your service
   - Navigate to the "Volumes" tab
   - Click "Add Volume"
   - Set mount path: `/data`
   - Set size: `1GB` (or as needed)
   - Save the volume

3. **Set Volume Environment Variable**
   - Go to "Variables" tab
   - Add variable: `RAILWAY_VOLUME_ID` = `[your-volume-id]`
   - The volume ID can be found in the URL when viewing the volume

4. **Required Environment Variables**
   - `OPENROUTER_API_KEY` - Your OpenRouter API key
   - `JWT_SECRET` - Secret for JWT tokens
   - `RAILWAY_VOLUME_ID` - Volume ID from step 3
   - `NODE_ENV` - Set to `production`
   - `PORT` - Set to `3001`

5. **Optional API Keys** (add as needed):
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY`
   - `GROQ_API_KEY`
   - `XAI_API_KEY`
   - `DEEPSEEK_API_KEY`

## Database Configuration

The app automatically configures the database path based on the environment:

- **Production (Railway)**: Uses `/data/database.db` (persistent volume)
- **Development**: Uses `./server/database.db` (local directory)

## Files Modified for Persistence

1. **railway.json** - Added volume mount configuration
2. **server/railway-server.js** - Updated database path logic

## Verifying Deployment

After deployment, check the logs to confirm:

```
✅ Database connection established
✅ Database test query successful
✅ Users table ready, current users: [count]
```

## Troubleshooting

### Database Not Persisting
- Verify volume is mounted at `/data`
- Check `RAILWAY_VOLUME_ID` environment variable is set
- Review deployment logs for database path messages

### Build Errors
- Ensure all required environment variables are set
- Check that the persistent volume has sufficient space
- Verify `nixpacks.toml` includes necessary system packages

## Admin Interface

Database admin endpoints are available at:
- `GET /api/admin/users` - View all users
- `GET /api/admin/models` - View all models
- `GET /api/admin/conversations` - View all conversations
- `GET /api/admin/documents` - View all documents

**Note**: These endpoints require authentication in production.