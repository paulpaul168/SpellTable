import { getApiUrl } from '@/utils/api';
import type { AuroraMonsterSummary, Fc5MonsterSummary, Monster } from '@/types/monster';

const API_BASE_URL = getApiUrl();

class MonsterService {
    async getMonsters(): Promise<Monster[]> {
        const response = await fetch(`${API_BASE_URL}/monsters`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch monsters');
        }

        return response.json();
    }

    async getAuroraCatalogStatus(): Promise<{ available: boolean; count: number }> {
        try {
            const response = await fetch(`${API_BASE_URL}/monsters/catalog/status`);
            if (!response.ok) return { available: false, count: 0 };
            return response.json();
        } catch {
            return { available: false, count: 0 };
        }
    }

    async getAuroraMonsters(query?: string): Promise<AuroraMonsterSummary[]> {
        const params = new URLSearchParams();
        if (query?.trim()) params.set('q', query.trim());
        const qs = params.toString();
        const response = await fetch(
            `${API_BASE_URL}/monsters/catalog${qs ? `?${qs}` : ''}`
        );
        if (response.status === 503) return [];
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch Aurora monsters');
        }
        return response.json();
    }

    async getFc5CatalogStatus(): Promise<{ available: boolean; count: number }> {
        try {
            const response = await fetch(`${API_BASE_URL}/monsters/fc5/status`);
            if (!response.ok) return { available: false, count: 0 };
            return response.json();
        } catch {
            return { available: false, count: 0 };
        }
    }

    async getFc5Monsters(
        query?: string,
        limit: number = 200
    ): Promise<Fc5MonsterSummary[]> {
        const params = new URLSearchParams();
        if (query?.trim()) params.set('q', query.trim());
        params.set('limit', String(limit));
        const response = await fetch(
            `${API_BASE_URL}/monsters/fc5?${params.toString()}`
        );
        if (response.status === 503) return [];
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch FC5 monsters');
        }
        return response.json();
    }

    async getMonster(monsterName: string): Promise<Monster> {
        const response = await fetch(
            `${API_BASE_URL}/monsters/${encodeURIComponent(monsterName)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch monster');
        }

        return response.json();
    }

    async createMonster(monster: Monster): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/monsters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(monster),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create monster');
        }
    }

    async updateMonster(monsterName: string, monster: Monster): Promise<void> {
        const response = await fetch(
            `${API_BASE_URL}/monsters/${encodeURIComponent(monsterName)}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(monster),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update monster');
        }
    }

    async deleteMonster(monsterName: string): Promise<void> {
        const response = await fetch(
            `${API_BASE_URL}/monsters/${encodeURIComponent(monsterName)}`,
            {
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete monster');
        }
    }

}

// Export a singleton instance
export const monsterService = new MonsterService();