import { Scene } from '../types/map';

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

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.ws = new WebSocket('ws://localhost:8010/ws');

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.notifyListeners({ type: 'connection_status', status: 'connected' });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as WebSocketMessage;
                this.notifyListeners(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.notifyListeners({ type: 'connection_status', status: 'disconnected' });
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
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
                console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                this.connect();
            }, delay);
        }
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
    }

    send(data: WebSocketMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error('WebSocket is not connected');
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
}

export const websocketService = new WebSocketService();