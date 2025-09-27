export interface EncounterGenerationRequest {
    character_levels: number[];
    difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
    monsters: { [name: string]: number };
}

export interface EncounterMonster {
    name: string;
    initiative: number;
    hp: number;
}

export interface EncounterGenerationResult {
    monsters: EncounterMonster[];
    total_monster_xp: number;
    adjusted_monster_xp: number;
    assessed_difficulty: string;
}
