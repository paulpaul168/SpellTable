import { Scene } from '@/types/map';
import { getApiUrl } from "@/utils/api";

interface WebSocketMessage {
    type: string;
    scene?: Scene;
    status?: string;
    [key: string]: unknown;
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private listeners: ((data: WebSocketMessage) => void)[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnecting = false;
    private messageQueue: string[] = [];
    private connectionCheckInterval: NodeJS.Timeout | null = null;

    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        const API_BASE_URL = getApiUrl();

        // Determine the correct WebSocket protocol based on the current page protocol
        let wsUrl: string;
        if (typeof window !== 'undefined') {
            // Client-side: use the same protocol as the current page
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            wsUrl = `${protocol}//${host}${API_BASE_URL}/ws`;
        } else {
            // Server-side: fallback to secure WebSocket
            wsUrl = `wss://${API_BASE_URL.replace('/api', '')}/api/ws`;
        }

        console.log('Attempting WebSocket connection to:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);
            this.setupWebSocketEventHandlers();
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.isConnecting = false;
            this.notifyListeners({ type: 'connection_status', status: 'error' });
            this.handleReconnect();
        }
    }

    private setupWebSocketEventHandlers() {
        if (!this.ws) return;

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            this.notifyListeners({ type: 'connection_status', status: 'connected' });

            // Start connection health check
            this.startConnectionHealthCheck();

            // Send any queued messages
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                if (message && this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(message);
                }
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as WebSocketMessage;
                this.notifyListeners(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            this.isConnecting = false;
            this.stopConnectionHealthCheck();
            this.notifyListeners({ type: 'connection_status', status: 'disconnected' });

            // Only attempt reconnect if it wasn't a manual close
            if (event.code !== 1000) {
                this.handleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.isConnecting = false;
            this.stopConnectionHealthCheck();
            this.notifyListeners({ type: 'connection_status', status: 'error' });
        };
    }

    private startConnectionHealthCheck() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }

        this.connectionCheckInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send a ping to keep the connection alive
                try {
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                } catch (error) {
                    console.warn('Failed to send ping, connection may be broken');
                    this.ws.close();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    private stopConnectionHealthCheck() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }

            this.reconnectTimeout = setTimeout(() => {
                console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                this.connect();
            }, delay);
        } else {
            console.log('⚠️ Max reconnection attempts reached');
            this.notifyListeners({ type: 'connection_status', status: 'failed' });
        }
    }

    send(data: WebSocketMessage) {
        const message = JSON.stringify(data);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(message);
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
                // Queue the message for retry
                this.messageQueue.push(message);
                this.reconnect();
            }
        } else {
            // Queue the message if the connection is not ready
            this.messageQueue.push(message);
            // Try to reconnect if not already connecting
            if (!this.isConnecting) {
                this.connect();
            }
        }
    }

    reconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connect();
    }

    addListener(listener: (data: WebSocketMessage) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(data: WebSocketMessage) {
        this.listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('Error in WebSocket listener:', error);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.stopConnectionHealthCheck();
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.messageQueue = [];
    }

    getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' | 'failed' {
        if (this.isConnecting) return 'connecting';
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return 'connected';
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return 'failed';
        return 'disconnected';
    }
}

export const websocketService = new WebSocketService();