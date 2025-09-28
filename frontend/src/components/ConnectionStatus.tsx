'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { websocketService } from '../services/websocket';
import { Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react';

export function ConnectionStatus() {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'failed'>('disconnected');

    useEffect(() => {
        const unsubscribe = websocketService.addListener((data) => {
            if (data.type === 'connection_status') {
                setStatus(data.status as any);
            }
        });

        // Get initial status
        setStatus(websocketService.getConnectionStatus());

        return unsubscribe;
    }, []);

    const getStatusConfig = () => {
        switch (status) {
            case 'connected':
                return {
                    icon: <Wifi className="h-4 w-4" />,
                    label: 'Connected',
                    variant: 'default' as const,
                    className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
                };
            case 'connecting':
                return {
                    icon: <Loader2 className="h-4 w-4 animate-spin" />,
                    label: 'Connecting...',
                    variant: 'secondary' as const,
                    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700'
                };
            case 'disconnected':
                return {
                    icon: <WifiOff className="h-4 w-4" />,
                    label: 'Disconnected',
                    variant: 'secondary' as const,
                    className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
                };
            case 'error':
                return {
                    icon: <AlertCircle className="h-4 w-4" />,
                    label: 'Connection Error',
                    variant: 'destructive' as const,
                    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700'
                };
            case 'failed':
                return {
                    icon: <AlertCircle className="h-4 w-4" />,
                    label: 'Connection Failed',
                    variant: 'destructive' as const,
                    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700'
                };
            default:
                return {
                    icon: <WifiOff className="h-4 w-4" />,
                    label: 'Unknown',
                    variant: 'secondary' as const,
                    className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
                };
        }
    };

    const handleReconnect = () => {
        if (status === 'failed' || status === 'error') {
            websocketService.reconnect();
        }
    };

    const config = getStatusConfig();

    return (
        <div className="flex items-center space-x-2">
            <Badge
                variant={config.variant}
                className={`flex items-center space-x-1 cursor-pointer ${config.className}`}
                onClick={handleReconnect}
                title={status === 'failed' || status === 'error' ? 'Click to reconnect' : 'Connection status'}
            >
                {config.icon}
                <span className="text-xs font-medium">{config.label}</span>
            </Badge>
        </div>
    );
}

