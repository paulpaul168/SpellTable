'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from './LoginForm';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { isAuthenticated, isAdmin, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto mb-4"></div>
                    <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginForm onLoginSuccess={() => { }} />;
    }

    if (requireAdmin && !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        Access Denied
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400">
                        You need admin privileges to access this page.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
