# Vercel Environment Variable Update Required

The frontend needs the following environment variable set in Vercel:

```
VITE_API_URL=https://bima-ai-decision-app-production.up.railway.app
```

This is critical because the frontend was calling localhost:3001 instead of the Railway production API, causing all OpenRouter requests to fail.

## Manual Steps Required:
1. Go to Vercel Dashboard -> Project Settings -> Environment Variables
2. Add: VITE_API_URL = https://bima-ai-decision-app-production.up.railway.app
3. Redeploy the project

Without this, the frontend cannot reach the Railway backend where OpenRouter is configured and working.