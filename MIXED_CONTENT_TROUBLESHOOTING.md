# Mixed Content Error Troubleshooting

## Problem
You're getting a mixed content error when trying to connect to the backend at `backend:8010` during login.

## What is Mixed Content?
Mixed content occurs when a secure page (HTTPS) tries to load resources from an insecure source (HTTP). Modern browsers block this for security reasons.

## Solutions

### Solution 1: Use HTTP for Development (Recommended)
For development, ensure both frontend and backend use HTTP:

1. **Check your environment variables**:
   ```bash
   # In frontend/.env.local or frontend/.env.development
   NEXT_PUBLIC_API_URL=http://localhost:8010
   ```

2. **Deploy with HTTP**:
   ```bash
   ./deploy.sh deploy
   ```

3. **Access via HTTP**:
   - Frontend: `http://localhost:3000`
   - Backend: Internal only (not exposed)

### Solution 2: Use HTTPS for Production
For production, use the HTTPS configuration:

1. **Deploy with HTTPS**:
   ```bash
   ./deploy.sh deploy docker-compose.https.yml
   ```

2. **Set up SSL certificates** (see PRODUCTION_DEPLOYMENT.md)

### Solution 3: Browser Workaround (Temporary)
If you need a quick fix for testing:

1. **Chrome/Edge**: 
   - Open DevTools (F12)
   - Click the shield icon in the address bar
   - Click "Site settings"
   - Set "Insecure content" to "Allow"

2. **Firefox**:
   - Click the shield icon in the address bar
   - Click "Turn off blocking for this site"

### Solution 4: Check Your Setup

1. **Verify Docker containers are running**:
   ```bash
   docker compose ps
   ```

2. **Check backend health**:
   ```bash
   docker compose exec backend curl http://localhost:8010/health
   ```

3. **Check frontend environment**:
   ```bash
   docker compose exec frontend env | grep NEXT_PUBLIC_API_URL
   ```

4. **Check network connectivity**:
   ```bash
   docker compose exec frontend ping backend
   ```

### Solution 5: Development Environment Variables

Create `frontend/.env.development`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8010
```

Create `frontend/.env.production`:
```env
NEXT_PUBLIC_API_URL=https://your-domain.com
```

## Common Issues

### Issue 1: Frontend trying to connect to HTTPS backend
**Symptoms**: Mixed content error in browser console
**Solution**: Ensure `NEXT_PUBLIC_API_URL` uses `http://` for development

### Issue 2: WebSocket connection failing
**Symptoms**: WebSocket connection errors in console
**Solution**: Check that WebSocket URL uses correct protocol (`ws://` for HTTP, `wss://` for HTTPS)

### Issue 3: CORS errors
**Symptoms**: CORS errors in browser console
**Solution**: Backend CORS is already configured to allow all origins

## Testing the Fix

1. **Clear browser cache and cookies**
2. **Restart the application**:
   ```bash
   docker compose down
   docker compose up -d --build
   ```
3. **Open browser DevTools** and check for errors
4. **Try logging in** and check the Network tab for successful requests

## Production Deployment

For production, use HTTPS:

1. **Set up SSL certificates**
2. **Use the HTTPS docker-compose**:
   ```bash
   ./deploy.sh deploy docker-compose.https.yml
   ```
3. **Configure your domain** to point to the server
4. **Set environment variables** for production

## Still Having Issues?

1. **Check the logs**:
   ```bash
   docker compose logs frontend
   docker compose logs backend
   ```

2. **Verify the deployment**:
   ```bash
   ./test-deployment.sh
   ```

3. **Check browser console** for specific error messages

4. **Ensure you're accessing the frontend via HTTP** (not HTTPS) in development
