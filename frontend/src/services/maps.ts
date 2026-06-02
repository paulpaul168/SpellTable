import { getApiUrl } from '@/utils/api';

export interface MapUploadSuccess {
    ok: true;
    filename: string;
    folder: string;
}

export interface MapUploadFailure {
    ok: false;
    filename: string;
    error: string;
}

export type MapUploadResult = MapUploadSuccess | MapUploadFailure;

const IMAGE_TYPES = /^image\//;

export function isMapImageFile(file: File): boolean {
    return IMAGE_TYPES.test(file.type);
}

export async function uploadMap(
    file: File,
    folder?: string | null
): Promise<MapUploadSuccess> {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
        formData.append('folder', folder);
    }

    const response = await fetch(`${getApiUrl()}/maps/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => 'Upload failed');
        throw new Error(text || 'Upload failed');
    }

    const data = await response.json();
    return {
        ok: true,
        filename: data.filename as string,
        folder: (data.folder as string) || '',
    };
}

const UPLOAD_CONCURRENCY = 3;

async function runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const i = nextIndex++;
            results[i] = await fn(items[i], i);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

export async function uploadMaps(
    files: File[],
    folder?: string | null,
    onProgress?: (completed: number, total: number) => void
): Promise<MapUploadResult[]> {
    const imageFiles = files.filter(isMapImageFile);
    const skipped = files.filter((f) => !isMapImageFile(f));

    const results: MapUploadResult[] = skipped.map((f) => ({
        ok: false,
        filename: f.name,
        error: 'Not an image file',
    }));

    let completed = 0;
    const uploadResults = await runWithConcurrency(imageFiles, UPLOAD_CONCURRENCY, async (file) => {
        try {
            const success = await uploadMap(file, folder);
            return success satisfies MapUploadResult;
        } catch (err) {
            return {
                ok: false,
                filename: file.name,
                error: err instanceof Error ? err.message : 'Upload failed',
            } satisfies MapUploadResult;
        } finally {
            completed += 1;
            onProgress?.(completed, imageFiles.length);
        }
    });

    return [...results, ...uploadResults];
}

export function summarizeUploadResults(results: MapUploadResult[]): {
    successes: MapUploadSuccess[];
    failures: MapUploadFailure[];
} {
    const successes: MapUploadSuccess[] = [];
    const failures: MapUploadFailure[] = [];
    for (const r of results) {
        if (r.ok) successes.push(r);
        else failures.push(r);
    }
    return { successes, failures };
}
