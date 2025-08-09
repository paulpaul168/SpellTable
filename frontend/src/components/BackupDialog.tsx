"use client"

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from './ui/use-toast';
import { backupService } from '@/services/api';
import { Download, Upload, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface BackupDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const BackupDialog: React.FC<BackupDialogProps> = ({ isOpen, onClose }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
    const [isProcessing, setIsProcessing] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        maps: true,
        scenes: true,
        audio: true,
        campaigns: true,
        diary: true,
        users: true,
        include_folders: [] as string[],
    });
    const [importOptions, setImportOptions] = useState({
        maps: true,
        scenes: true,
        audio: true,
        campaigns: true,
        diary: true,
        users: true,
    });
    const [importFile, setImportFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);

    const handleExport = async () => {
        setIsProcessing(true);
        setError(null);
        setProgress(0);
        setStatusMessage('Preparing export...');

        try {
            // Increment progress in steps to show activity
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev < 95) {
                        return prev + 5;
                    }
                    return prev;
                });
            }, 300);

            // Export backup returns a URL that we can use to download the file
            setStatusMessage('Generating backup file...');
            const downloadUrl = await backupService.exportBackup(exportOptions);

            // Create a temporary link and click it to trigger the download
            setStatusMessage('Downloading backup file...');
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'spelltable_backup.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Complete the progress bar
            clearInterval(progressInterval);
            setProgress(100);
            setStatusMessage('Export completed successfully!');

            toast({
                title: "Backup exported successfully",
                description: "Your backup has been downloaded.",
            });

            // Brief delay before closing to show 100% progress
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError('Failed to export backup. Please try again.');
            setStatusMessage('');
            setProgress(0);
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) {
            setError('Please select a backup file to import.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress(0);
        setStatusMessage('Preparing to import backup...');

        try {
            // Increment progress in steps to show activity
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev < 95) {
                        return prev + 5;
                    }
                    return prev;
                });
            }, 300);

            setStatusMessage(`Importing ${importFile.name}...`);
            await backupService.importBackup(importFile, importOptions);

            // Complete the progress bar
            clearInterval(progressInterval);
            setProgress(100);
            setStatusMessage('Import completed successfully!');

            toast({
                title: "Backup imported successfully",
                description: "Your backup has been restored.",
            });

            // Brief delay before closing to show 100% progress
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError('Failed to import backup. Please check your file and try again.');
            setStatusMessage('');
            setProgress(0);
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImportFile(e.target.files[0]);
            setError(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Backup Management</DialogTitle>
                    <DialogDescription>
                        Export or import your maps, scenes, audio files, campaigns, diary content, and user data (including passwords).
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="export" value={activeTab} onValueChange={(value) => setActiveTab(value as 'export' | 'import')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="export">Export</TabsTrigger>
                        <TabsTrigger value="import">Import</TabsTrigger>
                    </TabsList>

                    <TabsContent value="export" className="mt-4 space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="font-medium">Select content to export:</h3>
                                <div className="flex flex-col space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="export-maps"
                                            checked={exportOptions.maps}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setExportOptions({ ...exportOptions, maps: checked === true })}
                                        />
                                        <Label htmlFor="export-maps">Maps</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="export-scenes"
                                            checked={exportOptions.scenes}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setExportOptions({ ...exportOptions, scenes: checked === true })}
                                        />
                                        <Label htmlFor="export-scenes">Scenes</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="export-audio"
                                            checked={exportOptions.audio}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setExportOptions({ ...exportOptions, audio: checked === true })}
                                        />
                                        <Label htmlFor="export-audio">Audio</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="export-campaigns"
                                            checked={exportOptions.campaigns}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setExportOptions({ ...exportOptions, campaigns: checked === true })}
                                        />
                                        <Label htmlFor="export-campaigns">Campaigns</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="export-diary"
                                            checked={exportOptions.diary}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setExportOptions({ ...exportOptions, diary: checked === true })}
                                        />
                                        <Label htmlFor="export-diary">Diary</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="export-users"
                                            checked={exportOptions.users}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setExportOptions({ ...exportOptions, users: checked === true })}
                                        />
                                        <Label htmlFor="export-users">Users</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Future feature: Allow selecting specific folders to include */}
                            {/* <div className="space-y-2">
                <h3 className="font-medium">Filter by folders (optional):</h3>
                <div>
                  <p className="text-sm text-muted-foreground">Coming soon...</p>
                </div>
              </div> */}
                        </div>
                    </TabsContent>

                    <TabsContent value="import" className="mt-4 space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="font-medium">Select backup file:</h3>
                                <Input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleFileChange}
                                    disabled={isProcessing}
                                />
                                {importFile && (
                                    <p className="text-sm text-muted-foreground">
                                        Selected file: {importFile.name} ({Math.round(importFile.size / 1024)} KB)
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-medium">Import options:</h3>
                                <div className="flex flex-col space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="import-maps"
                                            checked={importOptions.maps}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setImportOptions({ ...importOptions, maps: checked === true })}
                                            disabled={isProcessing}
                                        />
                                        <Label htmlFor="import-maps">Maps</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="import-scenes"
                                            checked={importOptions.scenes}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setImportOptions({ ...importOptions, scenes: checked === true })}
                                            disabled={isProcessing}
                                        />
                                        <Label htmlFor="import-scenes">Scenes</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="import-audio"
                                            checked={importOptions.audio}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setImportOptions({ ...importOptions, audio: checked === true })}
                                            disabled={isProcessing}
                                        />
                                        <Label htmlFor="import-audio">Audio</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="import-campaigns"
                                            checked={importOptions.campaigns}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setImportOptions({ ...importOptions, campaigns: checked === true })}
                                            disabled={isProcessing}
                                        />
                                        <Label htmlFor="import-campaigns">Campaigns</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="import-diary"
                                            checked={importOptions.diary}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setImportOptions({ ...importOptions, diary: checked === true })}
                                            disabled={isProcessing}
                                        />
                                        <Label htmlFor="import-diary">Diary</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="import-users"
                                            checked={importOptions.users}
                                            onCheckedChange={(checked: boolean | "indeterminate") =>
                                                setImportOptions({ ...importOptions, users: checked === true })}
                                            disabled={isProcessing}
                                        />
                                        <Label htmlFor="import-users">Users</Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {isProcessing && (
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm">{statusMessage}</span>
                            <span className="text-sm">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                        Cancel
                    </Button>

                    {activeTab === 'export' ? (
                        <Button onClick={handleExport} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export Backup
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button onClick={handleImport} disabled={isProcessing || !importFile}>
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import Backup
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 