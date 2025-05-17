import React from 'react';

export const metadata = {
    title: 'Initiative Order | SpellTable',
    description: 'View the current initiative order.',
};

export default function InitiativeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
        </>
    );
} 