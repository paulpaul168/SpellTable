'use client';

import React, { Suspense } from 'react';
import { LoginForm } from '../../components/LoginForm';

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
                    Loading...
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
