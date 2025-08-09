/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,

    // Handle mixed content issues
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://localhost:3000 wss://localhost:3000;"
                    },
                ],
            },
        ];
    },

    // Allow mixed content for development
    experimental: {
        forceSwcTransforms: true,
    },
}

export default nextConfig 