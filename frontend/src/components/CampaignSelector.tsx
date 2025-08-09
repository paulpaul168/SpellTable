'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Campaign } from './CampaignManagement';
import { authService } from '../services/auth';
import { useToast } from './ui/use-toast';

interface CampaignSelectorProps {
    onCampaignSelect: (campaign: Campaign) => void;
}

export function CampaignSelector({ onCampaignSelect }: CampaignSelectorProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/campaigns/`, {
                headers: {
                    ...authService.getAuthHeader(),
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch campaigns');
            }

            const campaignsData = await response.json();
            setCampaigns(campaignsData);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load campaigns",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto mb-4"></div>
                    <p className="text-zinc-600 dark:text-zinc-400">Loading campaigns...</p>
                </div>
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No Campaigns Available</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        You don&apos;t have access to any campaigns yet. Please contact an administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        Select Your Campaign
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Choose a campaign to access its diary and notes
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {campaigns.map((campaign) => (
                        <Card
                            key={campaign.id}
                            className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => onCampaignSelect(campaign)}
                        >
                            <CardHeader>
                                <CardTitle className="text-zinc-900 dark:text-zinc-100">
                                    {campaign.name}
                                </CardTitle>
                                <CardDescription className="text-zinc-600 dark:text-zinc-400">
                                    {campaign.description || 'No description available'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {campaign.user_count} member{campaign.user_count !== 1 ? 's' : ''}
                                    </div>
                                    <Button
                                        className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCampaignSelect(campaign);
                                        }}
                                    >
                                        Enter Campaign
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
