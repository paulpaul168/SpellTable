'use client';

import React from 'react';
import { LoginForm } from '../../components/LoginForm';

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
            <LoginForm />
        </div>
    );
}
