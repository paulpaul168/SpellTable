import {getApiUrl} from "@/utils/api";
import {Monster} from "@/types/monster";

const API_BASE_URL = getApiUrl();

class MonsterService {

    async getMonsters(): Promise<Monster[]> {
        const response = await fetch(`${API_BASE_URL}/monsters/`, {
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

    async getMonster(monsterName: string): Promise<Monster> {
        const response = await fetch(`${API_BASE_URL}/monsters/${monsterName}`, {
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

        return response.json();
    }

    async updateMonster(monsterName: string, monster: Monster): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/monsters/${monsterName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(monster),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update monster');
        }

        return response.json();
    }

    async deleteMonster(monsterName: name): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/monsters/${monsterName}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete monster');
        }
    }

}

// Export a singleton instance
export const monsterService = new MonsterService();