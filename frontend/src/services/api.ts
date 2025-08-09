/**
 * API service for HTTP requests to the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Common headers for HTTP requests
const headers = {
    'Content-Type': 'application/json',
};

/**
 * Backup service for importing and exporting backups
 */
export const backupService = {
    /**
     * Export a backup with selected options
     * @param options Backup options
     * @returns URL to download the backup file
     */
    async exportBackup(options: {
        maps: boolean;
        scenes: boolean;
        audio: boolean;
        campaigns: boolean;
        diary: boolean;
        users: boolean;
        include_folders?: string[];
    }): Promise<string> {
        // Build query parameters for the options
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options)) {
            if (key === 'include_folders' && Array.isArray(value)) {
                value.forEach(folder => params.append('include_folders', folder));
            } else {
                params.append(key, value.toString());
            }
        }

        // Return the URL for downloading the backup
        return `${API_BASE_URL}/backup/export?${params.toString()}`;
    },

    /**
     * Import a backup file
     * @param file The backup file to import
     * @param options Import options
     * @returns Promise resolved when import is complete
     */
    async importBackup(
        file: File,
        options: {
            maps: boolean;
            scenes: boolean;
            audio: boolean;
            campaigns: boolean;
            diary: boolean;
            users: boolean;
        }
    ): Promise<void> {
        const formData = new FormData();
        formData.append('backup_file', file);

        // Add each option as a separate form field
        formData.append('maps', options.maps.toString());
        formData.append('scenes', options.scenes.toString());
        formData.append('audio', options.audio.toString());
        formData.append('campaigns', options.campaigns.toString());
        formData.append('diary', options.diary.toString());
        formData.append('users', options.users.toString());

        const response = await fetch(`${API_BASE_URL}/backup/import`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to import backup');
        }
    },

    /**
     * Get the list of folders for each content type
     * @returns Promise with folder structure
     */
    async getContentFolders(): Promise<{
        maps: string[];
        scenes: string[];
        audio: string[];
    }> {
        // For now, just return empty lists - this would be implemented later
        // when backend adds support for getting folder structures
        return {
            maps: [],
            scenes: [],
            audio: [],
        };
    },
}; 