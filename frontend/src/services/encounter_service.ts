import {getApiUrl} from "@/utils/api";
import {EncounterGenerationRequest, EncounterGenerationResult} from "@/types/encounter";

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

}

// Export a singleton instance
export const encounterService = new EncounterService();
