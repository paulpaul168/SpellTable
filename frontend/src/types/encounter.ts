export interface EncounterGenerationRequest {
    character_levels: number[];
    difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
    monsters: Record<string, number>;
}

export interface EncounterMonster {
    name: string;
    initiative: number;
    hp: number;
}

export interface EncounterGenerationResult {
    monsters: EncounterMonster[];
    monster_xp_total: number;
    monster_xp_with_modifiers: number;
    difficulty_rating: string;
    party_difficulty_thresholds: Record<string, number>
}
