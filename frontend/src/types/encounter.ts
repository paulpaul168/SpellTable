export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

export interface EncounterGenerationRequest {
    party_size: number;
    party_level: number;
    difficulty: EncounterDifficulty;
}

export interface EncounterMonster {
    name: string;
    initiative: number;
    hp: number;
}

export interface PartyThresholds {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
}

export interface EncounterGenerationResult {
    monsters: EncounterMonster[];
    monster_xp_total: number;
    monster_xp_adjusted: number;
    target_xp: number;
    party_thresholds: PartyThresholds;
    within_tolerance: boolean;
    difficulty: EncounterDifficulty;
    party_size: number;
    party_level: number;
}
