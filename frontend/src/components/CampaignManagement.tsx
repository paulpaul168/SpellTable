'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { authService, User } from '../services/auth';
import { useToast } from './ui/use-toast';

export interface Campaign {
    id: number;
    name: string;
    description?: string;
    is_active: boolean;
    created_by: number;
    created_at: string;
    updated_at: string;
    user_count: number;
}

export interface CampaignCreate {
    name: string;
    description?: string;
    user_ids: number[];
}

export interface CampaignUpdate {
    name?: string;
    description?: string;
    is_active?: boolean;
    user_ids?: number[];
}

class CampaignService {
    static API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

    static async getCampaigns(): Promise<Campaign[]> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns`, {
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch campaigns');
        }

        return response.json();
    }

    static async createCampaign(campaign: CampaignCreate): Promise<Campaign> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns`, {
            method: 'POST',
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(campaign),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create campaign');
        }

        return response.json();
    }

    static async updateCampaign(campaignId: number, campaign: CampaignUpdate): Promise<Campaign> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(campaign),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update campaign');
        }

        return response.json();
    }

    static async deleteCampaign(campaignId: number): Promise<void> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}`, {
            method: 'DELETE',
            headers: authService.getAuthHeader(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete campaign');
        }
    }

    static async getCampaignUsers(campaignId: number): Promise<User[]> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/users`, {
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch campaign users');
        }

        return response.json();
    }
}

export function CampaignManagement() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [formData, setFormData] = useState<CampaignCreate>({
        name: '',
        description: '',
        user_ids: [],
    });
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [campaignsData, usersData] = await Promise.all([
                CampaignService.getCampaigns(),
                authService.getUsers(),
            ]);
            setCampaigns(campaignsData);
            setUsers(usersData);
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

    const handleCreateCampaign = async () => {
        try {
            await CampaignService.createCampaign(formData);
            toast({
                title: "Success",
                description: "Campaign created successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            loadData();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create campaign",
                variant: "destructive",
            });
        }
    };

    const handleUpdateCampaign = async () => {
        if (!editingCampaign) return;

        try {
            const updateData: CampaignUpdate = {
                name: formData.name,
                description: formData.description,
                user_ids: formData.user_ids,
            };

            await CampaignService.updateCampaign(editingCampaign.id, updateData);
            toast({
                title: "Success",
                description: "Campaign updated successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            loadData();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update campaign",
                variant: "destructive",
            });
        }
    };

    const handleDeleteCampaign = async (campaignId: number) => {
        if (!confirm('Are you sure you want to delete this campaign?')) return;

        try {
            await CampaignService.deleteCampaign(campaignId);
            toast({
                title: "Success",
                description: "Campaign deleted successfully",
            });
            loadData();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete campaign",
                variant: "destructive",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            user_ids: [],
        });
        setEditingCampaign(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = async (campaign: Campaign) => {
        setEditingCampaign(campaign);

        // Fetch the specific campaign to get current user assignments
        try {
            const campaignUsers = await CampaignService.getCampaignUsers(campaign.id);
            const userIds = campaignUsers.map(user => user.id);

            setFormData({
                name: campaign.name,
                description: campaign.description || '',
                user_ids: userIds,
            });
        } catch (error) {
            // Fallback to basic campaign data
            setFormData({
                name: campaign.name,
                description: campaign.description || '',
                user_ids: [],
            });
        }

        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editingCampaign) {
            handleUpdateCampaign();
        } else {
            handleCreateCampaign();
        }
    };

    const toggleUserSelection = (userId: number) => {
        setFormData(prev => ({
            ...prev,
            user_ids: prev.user_ids.includes(userId)
                ? prev.user_ids.filter(id => id !== userId)
                : [...prev.user_ids, userId]
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Campaign Management</h2>
                    <p className="text-zinc-600 dark:text-zinc-400">Create and manage campaigns for your players</p>
                </div>
                <Button onClick={openCreateDialog} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                    Add Campaign
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"></div>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading campaigns...</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {campaigns.map((campaign) => (
                        <Card key={campaign.id} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div>
                                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                {campaign.name}
                                            </h3>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {campaign.description || 'No description'}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Badge variant={campaign.is_active ? 'default' : 'destructive'}>
                                                {campaign.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                            <Badge variant="secondary">
                                                {campaign.user_count} users
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(campaign)}
                                            className="border-zinc-200 dark:border-zinc-700"
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-900 dark:text-zinc-100">
                            {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                            {editingCampaign ? 'Update campaign information' : 'Create a new campaign for your players'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">Campaign Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-zinc-700 dark:text-zinc-300">Description</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-700 dark:text-zinc-300">Assign Users</Label>
                            {editingCampaign && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Note: Campaign creators cannot be removed from their campaigns.
                                </p>
                            )}
                            <div className="max-h-40 overflow-y-auto space-y-2">
                                {users.map((user) => {
                                    const isCreator = Boolean(editingCampaign && editingCampaign.created_by === user.id);
                                    return (
                                        <div key={user.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`user-${user.id}`}
                                                checked={formData.user_ids.includes(user.id)}
                                                onChange={() => toggleUserSelection(user.id)}
                                                disabled={isCreator || false}
                                                className="rounded border-zinc-300 dark:border-zinc-600 disabled:opacity-50"
                                            />
                                            <Label
                                                htmlFor={`user-${user.id}`}
                                                className={`text-sm ${isCreator ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                                            >
                                                {user.username} ({user.email})
                                                {isCreator && <span className="ml-1 text-xs text-zinc-400">(Creator)</span>}
                                            </Label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-zinc-200 dark:border-zinc-700">
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                                {editingCampaign ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
