import { getApiUrl } from '@/utils/api';
import type { SpellCatalogDetail, SpellCatalogEntry } from '@/types/monster';

const API_BASE_URL = getApiUrl();

class SpellCatalogService {
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/spells/catalog/status`);
            if (!response.ok) return false;
            const data = (await response.json()) as { available?: boolean };
            return Boolean(data.available);
        } catch {
            return false;
        }
    }

    async listSpells(query?: string): Promise<SpellCatalogEntry[]> {
        const params = new URLSearchParams();
        if (query?.trim()) params.set('q', query.trim());
        const qs = params.toString();
        const response = await fetch(
            `${API_BASE_URL}/spells/catalog${qs ? `?${qs}` : ''}`
        );
        if (response.status === 503) return [];
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch spell catalog');
        }
        return response.json();
    }

    async getSpell(spellId: string): Promise<SpellCatalogDetail | null> {
        const response = await fetch(
            `${API_BASE_URL}/spells/catalog/${encodeURIComponent(spellId)}`
        );
        if (response.status === 503 || response.status === 404) return null;
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch spell');
        }
        return response.json();
    }
}

export const spellCatalogService = new SpellCatalogService();
