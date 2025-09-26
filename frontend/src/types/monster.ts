export interface ArmorClass {
    ac: number;
    type?: string;
    shield?: boolean;
}

export interface HitPoints {
    average: number;
    hit_dice: string;
}

export interface Speed {
    walk?: string;
    fly?: string;
    swim?: string;
    burrow?: string;
    climb?: string;
}

export interface AbilityScores {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
}

export interface SavingThrowModifier {
    saving_throw: string;
    modifier: number;
}

export interface SkillModifier {
    skill: string;
    modifier: number;
}

export interface Senses {
    passive_perception: number;
    darkvision?: number;
}

export interface Challenge {
    rating: number;
    xp: number;
}

export interface Description {
    title: string;
    description: string;
}

export interface Monster {
    name: string;
    size: string;
    alignment?: string;
    armor: ArmorClass;
    hp: HitPoints;
    speed: Speed;

    ability_scores?: AbilityScores;

    saving_throws?: SavingThrowModifier[];
    skills?: SkillModifier[];
    damage_resistances?: string[];
    damage_immunities?: string[];
    condition_immunities?: string[];
    senses?: Senses;
    languages?: string[];
    challenge: Challenge;

    descriptions?: Description[];
    actions?: Description[];
    reactions?: Description[];
    legendary_actions?: Description[];
}
