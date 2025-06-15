/**
 * API utility functions
 */

export const getApiBaseUrl = (): string => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
};

export const getApiUrl = (endpoint: string): string => {
    const baseUrl = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
}; 