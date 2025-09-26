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

}

// Export a singleton instance
export const monsterService = new MonsterService();