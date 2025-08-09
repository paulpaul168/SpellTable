'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Campaign } from './CampaignManagement';
import { authService } from '../services/auth';
import { useToast } from './ui/use-toast';

export interface CampaignNote {
    id: number;
    campaign_id: number;
    author_id: number;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
    author_name: string;
}

export interface CampaignNoteCreate {
    title: string;
    content: string;
}

export interface CampaignNoteUpdate {
    title?: string;
    content?: string;
}

class CampaignNotesService {
    private static API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

    static async getCampaignNotes(campaignId: number): Promise<CampaignNote[]> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/notes`, {
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch campaign notes');
        }

        return response.json();
    }

    static async createCampaignNote(campaignId: number, note: CampaignNoteCreate): Promise<CampaignNote> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/notes`, {
            method: 'POST',
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(note),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create campaign note');
        }

        return response.json();
    }

    static async updateCampaignNote(campaignId: number, noteId: number, note: CampaignNoteUpdate): Promise<CampaignNote> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(note),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update campaign note');
        }

        return response.json();
    }

    static async deleteCampaignNote(campaignId: number, noteId: number): Promise<void> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/notes/${noteId}`, {
            method: 'DELETE',
            headers: authService.getAuthHeader(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete campaign note');
        }
    }
}

interface CampaignDiaryProps {
    campaign: Campaign;
    onBack: () => void;
}

export function CampaignDiary({ campaign, onBack }: CampaignDiaryProps) {
    const [notes, setNotes] = useState<CampaignNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<CampaignNote | null>(null);
    const [formData, setFormData] = useState<CampaignNoteCreate>({
        title: '',
        content: '',
    });
    const { toast } = useToast();

    useEffect(() => {
        loadNotes();
    }, [campaign.id]);

    const loadNotes = async () => {
        try {
            setIsLoading(true);
            const notesData = await CampaignNotesService.getCampaignNotes(campaign.id);
            setNotes(notesData);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load campaign notes",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNote = async () => {
        try {
            await CampaignNotesService.createCampaignNote(campaign.id, formData);
            toast({
                title: "Success",
                description: "Note created successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            loadNotes();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create note",
                variant: "destructive",
            });
        }
    };

    const handleUpdateNote = async () => {
        if (!editingNote) return;

        try {
            const updateData: CampaignNoteUpdate = {
                title: formData.title,
                content: formData.content,
            };

            await CampaignNotesService.updateCampaignNote(campaign.id, editingNote.id, updateData);
            toast({
                title: "Success",
                description: "Note updated successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            loadNotes();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update note",
                variant: "destructive",
            });
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            await CampaignNotesService.deleteCampaignNote(campaign.id, noteId);
            toast({
                title: "Success",
                description: "Note deleted successfully",
            });
            loadNotes();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete note",
                variant: "destructive",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            content: '',
        });
        setEditingNote(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = (note: CampaignNote) => {
        setEditingNote(note);
        setFormData({
            title: note.title,
            content: note.content,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editingNote) {
            handleUpdateNote();
        } else {
            handleCreateNote();
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const canEditNote = (note: CampaignNote) => {
        const currentUser = authService.getCurrentUser();
        return currentUser?.role === 'admin' || currentUser?.id === note.author_id;
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Button
                            variant="outline"
                            onClick={onBack}
                            className="mb-4 border-zinc-200 dark:border-zinc-700"
                        >
                            ← Back to Campaigns
                        </Button>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                            {campaign.name} - Campaign Diary
                        </h1>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                            {campaign.description || 'No description available'}
                        </p>
                    </div>
                    <Button
                        onClick={openCreateDialog}
                        className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                    >
                        + New Entry
                    </Button>
                </div>

                {/* Notes List */}
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"></div>
                        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading notes...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {notes.length === 0 ? (
                            <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                <CardContent className="p-8 text-center">
                                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                        No diary entries yet. Create the first entry to get started!
                                    </p>
                                    <Button
                                        onClick={openCreateDialog}
                                        className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                                    >
                                        Create First Entry
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            notes.map((note) => (
                                <Card key={note.id} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="text-zinc-900 dark:text-zinc-100 mb-2">
                                                    {note.title}
                                                </CardTitle>
                                                <div className="flex items-center space-x-2 text-sm text-zinc-500 dark:text-zinc-400">
                                                    <span>By {note.author_name}</span>
                                                    <span>•</span>
                                                    <span>{formatDate(note.created_at)}</span>
                                                    {note.updated_at !== note.created_at && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Edited {formatDate(note.updated_at)}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {canEditNote(note) && (
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditDialog(note)}
                                                        className="border-zinc-200 dark:border-zinc-700"
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteNote(note.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="prose prose-zinc dark:prose-invert max-w-none">
                                            <div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                                {note.content}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )}

                {/* Create/Edit Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 max-w-4xl">
                        <DialogHeader>
                            <DialogTitle className="text-zinc-900 dark:text-zinc-100">
                                {editingNote ? 'Edit Diary Entry' : 'New Diary Entry'}
                            </DialogTitle>
                            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                                {editingNote ? 'Update your diary entry' : 'Create a new diary entry for the campaign'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-zinc-700 dark:text-zinc-300">Title</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    placeholder="Enter a title for your entry..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="content" className="text-zinc-700 dark:text-zinc-300">Content</Label>
                                <textarea
                                    id="content"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full h-64 p-3 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 resize-none"
                                    placeholder="Write your diary entry here..."
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-zinc-200 dark:border-zinc-700">
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmit} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                                    {editingNote ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
