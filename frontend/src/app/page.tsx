'use client';

import React from 'react';
import { useEffect, useState } from 'react';

export default function Home() {
    const [message, setMessage] = useState('');
    const [ws, setWs] = useState<WebSocket | null>(null);

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8010/ws');

        socket.onopen = () => {
            console.log('Connected to WebSocket');
            setWs(socket);
        };

        socket.onmessage = (event) => {
            console.log('Message received:', event.data);
            setMessage(event.data);
        };

        socket.onclose = () => {
            console.log('Disconnected from WebSocket');
            setWs(null);
        };

        return () => {
            socket.close();
        };
    }, []);

    const sendMessage = () => {
        if (ws) {
            ws.send('Hello from frontend!');
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            <h1 className="text-4xl font-bold mb-8">SpellTable</h1>
            <div className="space-y-4">
                <button
                    onClick={sendMessage}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Send Test Message
                </button>
                <p className="text-lg">Server response: {message}</p>
            </div>
        </main>
    );
}