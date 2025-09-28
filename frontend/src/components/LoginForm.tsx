'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '@/contexts/AuthContext';

export function LoginForm() {
    const { login } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [credentials, setCredentials] = useState({
        username: '',
        password: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check for query parameters on mount
    useEffect(() => {
        const username = searchParams.get('username');
        const password = searchParams.get('password');

        if (username && password) {
            // Auto-login with query parameters
            handleAutoLogin(username, password);
        }
    }, [searchParams]);

    const handleAutoLogin = async (username: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await login(username, password);
            // Clear query parameters after successful login for security
            router.replace('/login');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Auto-login failed');
            // Clear query parameters even on failure for security
            router.replace('/login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await login(credentials.username, credentials.password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field: 'username' | 'password') => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setCredentials(prev => ({
            ...prev,
            [field]: e.target.value,
        }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 p-4">
            <Card className="w-full max-w-md shadow-lg border-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-100">
                        SpellTable Login
                    </CardTitle>
                    <CardDescription className="text-center text-zinc-600 dark:text-zinc-400">
                        Enter your credentials to access the application
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-zinc-700 dark:text-zinc-300">
                                Username
                            </Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Enter your username"
                                value={credentials.username}
                                onChange={handleInputChange('username')}
                                required
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={credentials.password}
                                onChange={handleInputChange('password')}
                                required
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            />
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-zinc-100"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                        <p className="mb-2">Default credentials:</p>
                        <div className="space-y-1 text-xs">
                            <p><strong>Admin:</strong> admin / admin123</p>
                            <p><strong>Viewer:</strong> viewer / viewer123</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
