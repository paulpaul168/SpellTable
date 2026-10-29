import { getApiUrl } from '@/utils/api';
import type {
    EncounterGenerationRequest,
    EncounterGenerationResult,
    PartyThresholds,
} from '@/types/encounter';

const API_BASE_URL = getApiUrl();

class EncounterServiceClient {
    async getXpLevels(partySize: number, partyLevel: number): Promise<PartyThresholds> {
        const params = new URLSearchParams({
            party_size: String(partySize),
            party_level: String(partyLevel),
        });
        const response = await fetch(`${API_BASE_URL}/encounters/xp-levels?${params}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch XP thresholds');
        }
        return response.json();
    }

    async generate(request: EncounterGenerationRequest): Promise<EncounterGenerationResult> {
        const response = await fetch(`${API_BASE_URL}/encounters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to generate encounter');
        }
        return response.json();
    }
}

export const encounterService = new EncounterServiceClient();
