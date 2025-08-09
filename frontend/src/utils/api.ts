/**
 * API utility functions
 */

export const getApiBaseUrl = (): string => {
    return '/api'; // Use frontend API routes
};

export const getApiUrl = (endpoint: string): string => {
    const baseUrl = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
}; 