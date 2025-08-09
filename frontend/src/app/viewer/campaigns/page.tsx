'use client';

import React, { useState, useEffect } from 'react';
import { CampaignSelector } from '../../../components/CampaignSelector';
import { EnhancedCampaignDiary } from '../../../components/EnhancedCampaignDiary';
import { Campaign } from '../../../components/CampaignManagement';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/auth';
import { Button } from '../../../components/ui/button';

export default function CampaignsPage() {
    const { user, logout } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/campaigns`, {
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

            // If user has only one campaign, auto-select it
            if (campaignsData.length === 1) {
                setSelectedCampaign(campaignsData[0]);
            }
        } catch (error) {
            console.error('Failed to load campaigns:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCampaignSelect = (campaign: Campaign) => {
        setSelectedCampaign(campaign);
    };

    const handleBackToCampaigns = () => {
        setSelectedCampaign(null);
    };

    if (isLoading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto mb-4"></div>
                        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    // If user has multiple campaigns and none selected, show selector
    if (campaigns.length > 1 && !selectedCampaign) {
        return (
            <ProtectedRoute>
                <CampaignSelector onCampaignSelect={handleCampaignSelect} />
            </ProtectedRoute>
        );
    }

    // If user has one campaign or a campaign is selected, show diary
    if (selectedCampaign) {
        return (
            <ProtectedRoute>
                <EnhancedCampaignDiary campaign={selectedCampaign} onBack={handleBackToCampaigns} />
            </ProtectedRoute>
        );
    }

    // If no campaigns available
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
                <div className="max-w-4xl mx-auto p-6">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                                Campaign Diary
                            </h1>
                            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                                Welcome, {user?.username}!
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button
                                onClick={() => window.location.href = '/viewer'}
                                variant="outline"
                                className="border-zinc-200 dark:border-zinc-700"
                            >
                                Back to Viewer
                            </Button>
                            <Button
                                onClick={logout}
                                variant="outline"
                                className="border-zinc-200 dark:border-zinc-700"
                            >
                                Logout
                            </Button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                            No Campaigns Available
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            You don&apos;t have access to any campaigns yet. Please contact an administrator to be assigned to a campaign.
                        </p>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
