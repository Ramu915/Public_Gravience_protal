# Deployment guide

## Frontend (Netlify)
1. Connect the repository to Netlify.
2. Set the base directory to `frontend`.
3. Use these build settings:
   - Build command: `npm run build`
   - Publish directory: `frontend/dist/client`
4. Add an environment variable:
   - `VITE_POCKETBASE_URL=https://your-pocketbase-domain.com`

## PocketBase
Use the included Docker setup for services like Render, Railway, Fly.io, or any container host.

### Render example
- Create a web service from this repo.
- Set the root directory to `pocketbase`.
- Use the included Dockerfile.
- Expose port `8080`.

### Important
- PocketBase data is stored in `pocketbase/pb_data`.
- For production, use a persistent volume or the service's persistent storage.
- After deployment, point the frontend's `VITE_POCKETBASE_URL` to the new PocketBase URL.
