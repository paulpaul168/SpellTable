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
    private connectionTimeout: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private isIntentionalClose = false;
    private messageQueue: WebSocketMessage[] = [];
    private isConnected = false;

    connect() {
        // Clear any existing connection timeout
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        // If we're already connected, don't try to connect again
        if (this.isConnected) {
            console.log('WebSocket already connected');
            return;
        }

        // If we're in the process of connecting, wait for that to complete
        if (this.socket?.readyState === WebSocket.CONNECTING) {
            console.log('WebSocket connection in progress, waiting...');
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.notifyListeners({ type: 'connection_status', status: 'disconnected' });
            return;
        }

        try {
            console.log('Attempting WebSocket connection...');
            this.socket = new WebSocket('ws://localhost:8010/ws');

            // Set a connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    console.error('WebSocket connection timeout');
                    this.socket?.close();
                    this.socket = null;
                    this.scheduleReconnect();
                }
            }, 5000); // 5 second timeout

            this.socket.onopen = () => {
                console.log('WebSocket connected successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.isIntentionalClose = false;
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                this.notifyListeners({ type: 'connection_status', status: 'connected' });
                this.processMessageQueue();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as WebSocketMessage;
                    console.log('Received WebSocket message:', data);
                    this.notifyListeners(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.isConnected = false;
                this.socket = null;
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                this.notifyListeners({ type: 'connection_status', status: 'disconnected' });

                if (!this.isIntentionalClose) {
                    this.scheduleReconnect();
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                this.notifyListeners({ type: 'connection_status', status: 'error' });
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.isConnected = false;
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout || this.isIntentionalClose) {
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay);
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

    private processMessageQueue() {
        console.log(`Processing ${this.messageQueue.length} queued messages`);
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            if (message) {
                this.send(message);
            }
        }
    }

    send(data: WebSocketMessage) {
        if (this.socket?.readyState === WebSocket.OPEN && this.isConnected) {
            try {
                console.log('Sending WebSocket message:', data);
                this.socket.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                this.messageQueue.push(data);
            }
        } else {
            console.warn('WebSocket is not connected, queueing message:', data);
            this.messageQueue.push(data);
            if (!this.isConnected) {
                console.log('Attempting to reconnect...');
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

    disconnect() {
        console.log('Disconnecting WebSocket...');
        this.isIntentionalClose = true;
        this.isConnected = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.reconnectAttempts = 0;
        this.messageQueue = [];
    }
}

export const websocketService = new WebSocketService();