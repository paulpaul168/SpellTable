import { Scene } from '../types/map';

interface WebSocketMessage {
    type: 'scene_update' | 'connection_status' | string;
    scene?: Scene;
    status?: string;
    [key: string]: unknown;
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private listeners: ((data: WebSocketMessage) => void)[] = [];
    private reconnectTimeout: NodeJS.Timeout | null = null;

    connect() {
        if (this.socket?.readyState === WebSocket.CONNECTING) {
            return; // Already trying to connect
        }

        try {
            this.socket = new WebSocket('ws://localhost:8010/ws');

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data) as WebSocketMessage;
                this.listeners.forEach(listener => listener(data));
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.socket = null;
                // Attempt to reconnect after 5 seconds
                if (!this.reconnectTimeout) {
                    this.reconnectTimeout = setTimeout(() => {
                        this.reconnectTimeout = null;
                        this.connect();
                    }, 5000);
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            // Attempt to reconnect after error
            if (!this.reconnectTimeout) {
                this.reconnectTimeout = setTimeout(() => {
                    this.reconnectTimeout = null;
                    this.connect();
                }, 5000);
            }
        }
    }

    send(data: WebSocketMessage) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket is not connected, message not sent:', data);
        }
    }

    addListener(listener: (data: WebSocketMessage) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const websocketService = new WebSocketService(); 