import { Scene } from '@/types/map';
import {getApiUrl} from "@/utils/api";

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

    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        const API_BASE_URL = getApiUrl();
        const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';

        console.log('Attempting WebSocket connection to:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            this.notifyListeners({ type: 'connection_status', status: 'connected' });

            // Send any queued messages
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                if (message) {
                    this.ws?.send(message);
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
            this.notifyListeners({ type: 'connection_status', status: 'disconnected' });
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.isConnecting = false;
            this.notifyListeners({ type: 'connection_status', status: 'error' });
        };
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
            this.ws.send(message);
        } else {
            // Queue the message if the connection is not ready
            this.messageQueue.push(message);
            // Try to reconnect if not already connecting
            if (!this.isConnecting) {
                this.connect();
            }
        }
    }

    addListener(listener: (data: WebSocketMessage) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(data: WebSocketMessage) {
        this.listeners.forEach(listener => listener(data));
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
}

export const websocketService = new WebSocketService();