const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Prepare the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Backend URL for proxying
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8010';

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            const { pathname } = parsedUrl;

            // Handle API routes - proxy to backend
            if (pathname.startsWith('/api/')) {
                const backendPath = pathname.replace('/api/', '');
                const backendUrl = `${BACKEND_URL}/${backendPath}`;

                // Forward the request to the backend
                const response = await fetch(backendUrl, {
                    method: req.method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...Object.fromEntries(Object.entries(req.headers).filter(([key]) =>
                            !['host', 'connection'].includes(key.toLowerCase())
                        )),
                    },
                    body: req.method !== 'GET' ? JSON.stringify(await getRequestBody(req)) : undefined,
                });

                const data = await response.json();

                res.writeHead(response.status, {
                    'Content-Type': 'application/json',
                });
                res.end(JSON.stringify(data));
                return;
            }

            // Handle all other routes with Next.js
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    // WebSocket server for proxying WebSocket connections
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const { pathname } = parse(req.url, true);

        // Only handle WebSocket connections to /api/ws
        if (pathname === '/api/ws') {
            console.log('WebSocket client connected, proxying to backend');

            // Create WebSocket connection to backend
            const backendWs = new WebSocket(`${BACKEND_URL.replace('http', 'ws')}/ws`);

            // Forward messages from client to backend
            ws.on('message', (message) => {
                if (backendWs.readyState === WebSocket.OPEN) {
                    backendWs.send(message);
                }
            });

            // Forward messages from backend to client
            backendWs.on('message', (message) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            });

            // Handle disconnections
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                backendWs.close();
            });

            backendWs.on('close', () => {
                console.log('Backend WebSocket disconnected');
                ws.close();
            });

            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket client error:', error);
                backendWs.close();
            });

            backendWs.on('error', (error) => {
                console.error('Backend WebSocket error:', error);
                ws.close();
            });
        }
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});

// Helper function to get request body
function getRequestBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}
