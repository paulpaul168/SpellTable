import {getApiUrl} from "@/utils/api";
import {
    EncounterBuilder,
    EncounterGenerationRequest,
    EncounterGenerationResult,
    EncounterMonster,
    XpLevels
} from "@/types/encounter";

const API_BASE_URL = getApiUrl();

class EncounterService {

    async createEncounter(request: EncounterGenerationRequest): Promise<EncounterGenerationResult> {
        const response = await fetch(`${API_BASE_URL}/encounters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create encounter');
        }

        return response.json();
    }

    async getXpLevels(characterLevels: number[]): Promise<XpLevels> {
        const params = new URLSearchParams({
            levels: characterLevels.join(',')
        });
        const response = await fetch(`${API_BASE_URL}/encounters/xp-levels?${params}`, {
            method: 'GET',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch XP levels');
        }

        return response.json();
    }

    async generateMonsterInitiative(encounterBuilder: EncounterBuilder): Promise<EncounterMonster[]> {
        const response = await fetch(`${API_BASE_URL}/encounters/monsters/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(encounterBuilder),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate monster initiative');
        }

        return response.json();
    }

}

// Export a singleton instance
export const encounterService = new EncounterService();
