'use client';

import React from 'react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';

export function LogoutButton() {
    const { isAuthenticated, logout, user } = useAuth();

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
                Welcome, {user?.username} ({user?.role})
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="text-xs"
            >
                Logout
            </Button>
        </div>
    );
}
