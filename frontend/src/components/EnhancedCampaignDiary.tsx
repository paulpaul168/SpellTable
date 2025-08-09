'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Campaign } from './CampaignManagement';
import { authService } from '../services/auth';
import { useToast } from './ui/use-toast';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Upload, Image, X, Download, Trash2, ChevronDown, ChevronRight, Folder, SortAsc, SortDesc, Maximize2, Minimize2 } from 'lucide-react';

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

export interface CampaignImage {
    id: number;
    campaign_id: number;
    uploaded_by: number;
    filename: string;
    original_filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    description?: string;
    created_at: string;
    uploader_name: string;
    url: string;
}

class CampaignNotesService {
    private static API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

    static async getCampaignNotes(campaignId: number): Promise<CampaignNote[]> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/notes`, {
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch campaign notes');
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
            throw new Error('Failed to create campaign note');
        }

        return response.json();
    }

    static async updateCampaignNote(noteId: number, note: CampaignNoteUpdate): Promise<CampaignNote> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(note),
        });

        if (!response.ok) {
            throw new Error('Failed to update campaign note');
        }

        return response.json();
    }

    static async deleteCampaignNote(noteId: number): Promise<void> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/notes/${noteId}`, {
            method: 'DELETE',
            headers: {
                ...authService.getAuthHeader(),
            },
        });

        if (!response.ok) {
            throw new Error('Failed to delete campaign note');
        }
    }
}

class CampaignImagesService {
    private static API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

    static async getCampaignImages(campaignId: number): Promise<CampaignImage[]> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/images`, {
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch campaign images');
        }

        return response.json();
    }

    static async uploadCampaignImage(campaignId: number, file: File, description?: string): Promise<CampaignImage> {
        const formData = new FormData();
        formData.append('file', file);
        if (description) {
            formData.append('description', description);
        }

        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/images`, {
            method: 'POST',
            headers: {
                ...authService.getAuthHeader(),
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to upload image');
        }

        return response.json();
    }

    static async deleteCampaignImage(campaignId: number, imageId: number): Promise<void> {
        const response = await fetch(`${this.API_BASE_URL}/campaigns/${campaignId}/images/${imageId}`, {
            method: 'DELETE',
            headers: authService.getAuthHeader(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete image');
        }
    }
}

interface EnhancedCampaignDiaryProps {
    campaign: Campaign;
    onBack: () => void;
}

export function EnhancedCampaignDiary({ campaign, onBack }: EnhancedCampaignDiaryProps) {
    const [notes, setNotes] = useState<CampaignNote[]>([]);
    const [images, setImages] = useState<CampaignImage[]>([]);
    const [imageUrls, setImageUrls] = useState<{ [key: number]: string }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
    const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<CampaignNote | null>(null);
    const [noteFormData, setNoteFormData] = useState<CampaignNoteCreate>({
        title: '',
        content: '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageDescription, setImageDescription] = useState('');
    const [activeTab, setActiveTab] = useState('diary');
    const [selectedImage, setSelectedImage] = useState<CampaignImage | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest');
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [fullscreenNote, setFullscreenNote] = useState<CampaignNote | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        loadData();

        // Cleanup blob URLs on unmount
        return () => {
            Object.values(imageUrls).forEach(url => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [campaign.id]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [notesData, imagesData] = await Promise.all([
                CampaignNotesService.getCampaignNotes(campaign.id),
                CampaignImagesService.getCampaignImages(campaign.id),
            ]);
            setNotes(notesData);
            setImages(imagesData);

            // Load image URLs
            const urls: { [key: number]: string } = {};
            for (const image of imagesData) {
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}${image.url}`, {
                        headers: {
                            ...authService.getAuthHeader(),
                        },
                    });
                    if (response.ok) {
                        const blob = await response.blob();
                        urls[image.id] = URL.createObjectURL(blob);
                    } else {
                        console.warn(`Failed to load image ${image.id}: ${response.status}`);
                    }
                } catch (error) {
                    console.error(`Failed to load image ${image.id}:`, error);
                }
            }
            setImageUrls(urls);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load campaign data",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Note management functions
    const handleCreateNote = async () => {
        try {
            await CampaignNotesService.createCampaignNote(campaign.id, noteFormData);
            toast({
                title: "Success",
                description: "Note created successfully",
            });
            setIsNoteDialogOpen(false);
            resetNoteForm();
            loadData();
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
                title: noteFormData.title,
                content: noteFormData.content,
            };

            await CampaignNotesService.updateCampaignNote(editingNote.id, updateData);
            toast({
                title: "Success",
                description: "Note updated successfully",
            });
            setIsNoteDialogOpen(false);
            resetNoteForm();
            loadData();
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
            await CampaignNotesService.deleteCampaignNote(noteId);
            toast({
                title: "Success",
                description: "Note deleted successfully",
            });
            loadData();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete note",
                variant: "destructive",
            });
        }
    };

    // Image management functions
    const handleUploadImage = async () => {
        if (!imageFile) return;

        try {
            await CampaignImagesService.uploadCampaignImage(campaign.id, imageFile, imageDescription);
            toast({
                title: "Success",
                description: "Image uploaded successfully",
            });
            setIsImageDialogOpen(false);
            resetImageForm();
            loadData();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to upload image",
                variant: "destructive",
            });
        }
    };

    const handleDeleteImage = async (imageId: number) => {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            await CampaignImagesService.deleteCampaignImage(campaign.id, imageId);
            toast({
                title: "Success",
                description: "Image deleted successfully",
            });
            loadData();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete image",
                variant: "destructive",
            });
        }
    };

    const resetNoteForm = () => {
        setNoteFormData({
            title: '',
            content: '',
        });
        setEditingNote(null);
    };

    const resetImageForm = () => {
        setImageFile(null);
        setImageDescription('');
    };

    const openCreateNoteDialog = () => {
        resetNoteForm();
        setIsNoteDialogOpen(true);
    };

    const openEditNoteDialog = (note: CampaignNote) => {
        setEditingNote(note);
        setNoteFormData({
            title: note.title,
            content: note.content,
        });
        setIsNoteDialogOpen(true);
    };

    const openImageUploadDialog = () => {
        resetImageForm();
        setIsImageDialogOpen(true);
    };

    const handleNoteSubmit = () => {
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

    const canDeleteImage = (image: CampaignImage) => {
        const currentUser = authService.getCurrentUser();
        return currentUser?.role === 'admin' || currentUser?.id === image.uploaded_by;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Helper functions for sorting and filtering
    const sortedAndFilteredNotes = React.useMemo(() => {
        let filteredNotes = notes;

        // Filter by folder (for now, we'll use 'all' as default)
        if (selectedFolder !== 'all') {
            // TODO: Implement folder filtering when backend supports it
            filteredNotes = notes;
        }

        // Sort notes
        return [...filteredNotes].sort((a, b) => {
            switch (sortOrder) {
                case 'newest':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'oldest':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'title':
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });
    }, [notes, sortOrder, selectedFolder]);

    const toggleNoteExpansion = (noteId: number) => {
        const newExpandedNotes = new Set(expandedNotes);
        if (newExpandedNotes.has(noteId)) {
            newExpandedNotes.delete(noteId);
        } else {
            newExpandedNotes.add(noteId);
        }
        setExpandedNotes(newExpandedNotes);
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
            <div className="max-w-7xl mx-auto p-6">
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
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="diary">Diary Entries</TabsTrigger>
                        <TabsTrigger value="images">Images</TabsTrigger>
                    </TabsList>

                    <TabsContent value="diary" className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Diary Entries</h2>
                            <div className="flex items-center space-x-4">
                                {/* Sort dropdown */}
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Sort by:</span>
                                    <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest' | 'title') => setSortOrder(value)}>
                                        <SelectTrigger className="w-32 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Newest</SelectItem>
                                            <SelectItem value="oldest">Oldest</SelectItem>
                                            <SelectItem value="title">Title</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Folder filter dropdown */}
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Folder:</span>
                                    <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                                        <SelectTrigger className="w-32 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            {/* TODO: Add folders when backend supports them */}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={openCreateNoteDialog}
                                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                                >
                                    + New Entry
                                </Button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"></div>
                                <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading notes...</p>
                            </div>
                        ) : (
                            <div className="h-[calc(100vh-350px)] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
                                {sortedAndFilteredNotes.length === 0 ? (
                                    <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                        <CardContent className="p-8 text-center">
                                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                                No diary entries yet. Create the first entry to get started!
                                            </p>
                                            <Button
                                                onClick={openCreateNoteDialog}
                                                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                                            >
                                                Create First Entry
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    sortedAndFilteredNotes.map((note) => (
                                        <Card key={note.id} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                            <CardHeader className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors group" onClick={() => toggleNoteExpansion(note.id)}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 flex items-center space-x-2">
                                                        <div className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                                                            {expandedNotes.has(note.id) ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </div>
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
                                                    </div>
                                                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setFullscreenNote(note)}
                                                            className="border-zinc-200 dark:border-zinc-700"
                                                        >
                                                            <Maximize2 className="h-4 w-4 mr-2" />
                                                            Open
                                                        </Button>
                                                        {canEditNote(note) && (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openEditNoteDialog(note)}
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
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            {expandedNotes.has(note.id) && (
                                                <CardContent>
                                                    <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-6 prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-5 prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4 prose-h4:text-base prose-h4:mb-2 prose-h4:mt-3 prose-p:mb-4 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-1 prose-strong:font-semibold prose-em:italic prose-blockquote:border-l-4 prose-blockquote:border-zinc-300 dark:prose-blockquote:border-zinc-600 prose-blockquote:pl-4 prose-blockquote:italic">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {note.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    ))
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="images" className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Campaign Images</h2>
                            <Button
                                onClick={openImageUploadDialog}
                                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Image
                            </Button>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"></div>
                                <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading images...</p>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {images.length === 0 ? (
                                    <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 col-span-full">
                                        <CardContent className="p-8 text-center">
                                            <Image className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                                No images uploaded yet. Upload the first image to get started!
                                            </p>
                                            <Button
                                                onClick={openImageUploadDialog}
                                                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                                            >
                                                Upload First Image
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    images.map((image) => (
                                        <Card key={image.id} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                            <CardContent className="p-4">
                                                <div className="aspect-square mb-4 overflow-hidden rounded-lg">
                                                    <img
                                                        src={imageUrls[image.id] || `${process.env.NEXT_PUBLIC_API_URL || '/api'}${image.url}`}
                                                        alt={image.original_filename}
                                                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => {
                                                            setSelectedImage(image);
                                                            setIsImageModalOpen(true);
                                                        }}
                                                        onError={(e) => {
                                                            // Fallback: try to fetch the image with authentication
                                                            if (!imageUrls[image.id]) {
                                                                fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}${image.url}`, {
                                                                    headers: {
                                                                        ...authService.getAuthHeader(),
                                                                    },
                                                                })
                                                                    .then(response => response.blob())
                                                                    .then(blob => {
                                                                        const url = URL.createObjectURL(blob);
                                                                        e.currentTarget.src = url;
                                                                    })
                                                                    .catch(error => {
                                                                        console.error('Failed to load image:', error);
                                                                        e.currentTarget.style.display = 'none';
                                                                    });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                        {image.original_filename}
                                                    </h3>
                                                    {image.description && (
                                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                            {image.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                                        <span>{formatFileSize(image.file_size)}</span>
                                                        <span>{formatDate(image.created_at)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            By {image.uploader_name}
                                                        </span>
                                                        <div className="flex items-center space-x-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || '/api'}${image.url}`, '_blank')}
                                                                className="h-6 w-6 p-0 border-zinc-200 dark:border-zinc-700"
                                                            >
                                                                <Download className="h-3 w-3" />
                                                            </Button>
                                                            {canDeleteImage(image) && (
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteImage(image.id)}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Note Create/Edit Dialog */}
                {isNoteDialogOpen && (
                    <div className="fixed inset-0 z-[9999] bg-black/50" onClick={() => setIsNoteDialogOpen(false)}>
                        <div className="fixed top-[1vh] left-[1vw] w-[98vw] h-[98vh] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="relative h-full flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                            {editingNote ? 'Edit Diary Entry' : 'New Diary Entry'}
                                        </h3>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {editingNote ? 'Update your diary entry' : 'Create a new diary entry for the campaign'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsNoteDialogOpen(false)}
                                        className="shrink-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="space-y-4 max-w-4xl mx-auto">
                                        <div className="space-y-2">
                                            <Label htmlFor="title" className="text-zinc-700 dark:text-zinc-300">Title</Label>
                                            <Input
                                                id="title"
                                                value={noteFormData.title}
                                                onChange={(e) => setNoteFormData({ ...noteFormData, title: e.target.value })}
                                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                                placeholder="Enter a title for your entry..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="content" className="text-zinc-700 dark:text-zinc-300">Content (Markdown)</Label>
                                            <div data-color-mode="auto" className="h-[calc(98vh-300px)]">
                                                <MDEditor
                                                    value={noteFormData.content}
                                                    onChange={(value) => setNoteFormData({ ...noteFormData, content: value || '' })}
                                                    height="100%"
                                                    preview="edit"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                                            <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)} className="border-zinc-200 dark:border-zinc-700">
                                                Cancel
                                            </Button>
                                            <Button onClick={handleNoteSubmit} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                                                {editingNote ? 'Update' : 'Create'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Image Upload Dialog */}
                <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                    <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                        <DialogHeader>
                            <DialogTitle className="text-zinc-900 dark:text-zinc-100">
                                Upload Image
                            </DialogTitle>
                            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                                Upload an image for the campaign. Supported formats: JPEG, PNG, GIF, WebP (max 10MB)
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="image" className="text-zinc-700 dark:text-zinc-300">Image File</Label>
                                <Input
                                    id="image"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                    className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-zinc-700 dark:text-zinc-300">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    value={imageDescription}
                                    onChange={(e) => setImageDescription(e.target.value)}
                                    className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    placeholder="Enter a description for the image..."
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button variant="outline" onClick={() => setIsImageDialogOpen(false)} className="border-zinc-200 dark:border-zinc-700">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUploadImage}
                                    disabled={!imageFile}
                                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                                >
                                    Upload
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Image Modal Dialog */}
                <Dialog open={isImageModalOpen} onOpenChange={(open) => {
                    setIsImageModalOpen(open);
                    if (!open) {
                        setSelectedImage(null);
                    }
                }}>
                    <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 max-w-[98vw] max-h-[98vh] w-[98vw] h-[98vh] p-0 overflow-hidden !max-w-[98vw] !w-[98vw] !h-[98vh] !max-h-[98vh]">
                        <div className="relative h-full flex flex-col">
                            {/* Header with close button */}
                            <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                                <div className="flex-1 min-w-0">
                                    {selectedImage && (
                                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-8">
                                            {selectedImage.original_filename}
                                        </h3>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsImageModalOpen(false);
                                        setSelectedImage(null);
                                    }}
                                    className="shrink-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Image container */}
                            <div className="flex-1 flex flex-col items-center justify-center p-2 overflow-hidden">
                                {selectedImage && (
                                    <>
                                        <div className="flex-1 flex items-center justify-center w-full h-full min-h-0">
                                            <img
                                                src={imageUrls[selectedImage.id] || `${process.env.NEXT_PUBLIC_API_URL || '/api'}${selectedImage.url}`}
                                                alt={selectedImage.original_filename}
                                                className="rounded-lg shadow-lg"
                                                style={{
                                                    maxHeight: 'calc(98vh - 200px)',
                                                    maxWidth: 'calc(98vw - 8rem)',
                                                    minHeight: '700px',
                                                    minWidth: '600px',
                                                    width: 'auto',
                                                    height: 'auto',
                                                    objectFit: 'contain'
                                                }}
                                                onError={(e) => {
                                                    // Fallback: try to fetch the image with authentication
                                                    if (!imageUrls[selectedImage.id]) {
                                                        fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}${selectedImage.url}`, {
                                                            headers: {
                                                                ...authService.getAuthHeader(),
                                                            },
                                                        })
                                                            .then(response => response.blob())
                                                            .then(blob => {
                                                                const url = URL.createObjectURL(blob);
                                                                e.currentTarget.src = url;
                                                            })
                                                            .catch(error => {
                                                                console.error('Failed to load image:', error);
                                                                e.currentTarget.style.display = 'none';
                                                            });
                                                    }
                                                }}
                                            />
                                        </div>

                                        {/* Image details */}
                                        <div className="mt-4 text-center space-y-2 w-full max-w-2xl mx-auto">
                                            {selectedImage.description && (
                                                <p className="text-zinc-600 dark:text-zinc-400 text-sm px-4">
                                                    {selectedImage.description}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-center space-x-4 text-sm text-zinc-500 dark:text-zinc-400">
                                                <span>{formatFileSize(selectedImage.file_size)}</span>
                                                <span>•</span>
                                                <span>By {selectedImage.uploader_name}</span>
                                                <span>•</span>
                                                <span>{formatDate(selectedImage.created_at)}</span>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center justify-center space-x-3 pt-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || '/api'}${selectedImage.url}`, '_blank')}
                                                    className="border-zinc-200 dark:border-zinc-700"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </Button>
                                                {canDeleteImage(selectedImage) && (
                                                    <Button
                                                        variant="destructive"
                                                        onClick={() => {
                                                            handleDeleteImage(selectedImage.id);
                                                            setIsImageModalOpen(false);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Fullscreen Note Modal */}
                {fullscreenNote && (
                    <div className="fixed inset-0 z-[9999] bg-black/50" onClick={() => setFullscreenNote(null)}>
                        <div className="fixed top-[1vh] left-[1vw] w-[98vw] h-[98vh] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="relative h-full flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-8">
                                            {fullscreenNote.title}
                                        </h3>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setFullscreenNote(null)}
                                        className="shrink-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                                    >
                                        <Minimize2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {/* Note metadata */}
                                    <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4 text-sm text-zinc-500 dark:text-zinc-400">
                                                <span>By {fullscreenNote.author_name}</span>
                                                <span>•</span>
                                                <span>{formatDate(fullscreenNote.created_at)}</span>
                                                {fullscreenNote.updated_at !== fullscreenNote.created_at && (
                                                    <>
                                                        <span>•</span>
                                                        <span>Edited {formatDate(fullscreenNote.updated_at)}</span>
                                                    </>
                                                )}
                                            </div>
                                            {canEditNote(fullscreenNote) && (
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setFullscreenNote(null);
                                                            openEditNoteDialog(fullscreenNote);
                                                        }}
                                                        className="border-zinc-200 dark:border-zinc-700"
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => {
                                                            handleDeleteNote(fullscreenNote.id);
                                                            setFullscreenNote(null);
                                                        }}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Note content */}
                                    <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 prose-headings:font-bold prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8 prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-6 prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-5 prose-h4:text-lg prose-h4:mb-3 prose-h4:mt-4 prose-p:mb-4 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-1 prose-strong:font-semibold prose-em:italic prose-blockquote:border-l-4 prose-blockquote:border-zinc-300 dark:prose-blockquote:border-zinc-600 prose-blockquote:pl-4 prose-blockquote:italic">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {fullscreenNote.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
