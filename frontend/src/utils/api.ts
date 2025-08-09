/**
 * API utility functions
 */

export const getApiBaseUrl = (): string => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
};

export function getApiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || '/api';
} 