'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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

    useEffect(() => {
        if (!searchParams) return;
        const username = searchParams.get('username');
        const password = searchParams.get('password');

        if (username && password) {
            handleAutoLogin(username, password);
        }
    }, [searchParams]);

    const handleAutoLogin = async (username: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await login(username, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Auto-login failed');
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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(220_70%_50%_/_0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_hsl(240_6%_40%_/_0.2),_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_hsl(220_70%_55%_/_0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_hsl(240_5%_20%_/_0.45),_transparent_50%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-in fade-in duration-1000"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-zinc-400/10 blur-3xl dark:bg-zinc-500/10 animate-in fade-in duration-1000"
            />

            <div className="relative z-10 w-full max-w-sm">
                <div className="mb-10 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
                    <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                        SpellTable
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Sign in to continue
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
                    style={{ animationDelay: '80ms' }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            type="text"
                            placeholder="Username"
                            autoComplete="username"
                            value={credentials.username}
                            onChange={handleInputChange('username')}
                            required
                            className="h-11 bg-background/60 backdrop-blur-sm transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.2)]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Password"
                            autoComplete="current-password"
                            value={credentials.password}
                            onChange={handleInputChange('password')}
                            required
                            className="h-11 bg-background/60 backdrop-blur-sm transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.2)]"
                        />
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-in fade-in zoom-in-95 duration-200"
                        >
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        size="lg"
                        className="w-full transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
