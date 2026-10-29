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
    walk?: number;
    fly?: number;
    swim?: number;
    burrow?: number;
    climb?: number;
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

export type MonsterSpellUsage = 'slot' | 'at_will' | 'per_day';

export interface MonsterSpell {
    name: string;
    level: number;
    notes?: string;
    usage?: MonsterSpellUsage;
    per_day?: number;
    source?: string;
    external_id?: string;
}

export interface MonsterSpellcasting {
    ability?: string;
    save_dc?: number;
    attack_bonus?: number;
    /** Index 0 = 1st level … 8 = 9th. */
    slots?: number[];
    spells?: MonsterSpell[];
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
    /** Habitat tags e.g. forest, underdark — used for encounter filtering. */
    environments?: string[];

    descriptions?: Description[];
    actions?: Description[];
    reactions?: Description[];
    legendary_actions?: Description[];
    spellcasting?: MonsterSpellcasting;
}

/** Lightweight Aurora / BYO spell catalog entry (name/level only by default). */
export interface SpellCatalogEntry {
    id: string;
    name: string;
    level: number;
    school?: string;
    source?: string;
}

export interface SpellCatalogDetail extends SpellCatalogEntry {
    description_html?: string;
}

/** Aurora Companion / Monster catalog summary (BYO elements root). */
export interface AuroraMonsterSummary {
    id: string;
    name: string;
    source?: string;
    size?: string;
    challenge?: number;
    ac?: number;
    hp_average?: number;
    creature_type: string;
    /** Use as InitiativeEntry.monsterName when adding from Aurora. */
    monsterName: string;
}

/** Fight Club 5e XML catalog summary (BYO FC5_ROOT). */
export interface Fc5MonsterSummary {
    id: string;
    name: string;
    source?: string;
    size?: string;
    challenge?: number;
    ac?: number;
    hp_average?: number;
    creature_type?: string;
    /** Use as InitiativeEntry.monsterName when adding from FC5. */
    monsterName: string;
}

export const AURORA_MONSTER_PREFIX = 'aurora:';
export const FC5_MONSTER_PREFIX = 'fc5:';

export function isAuroraMonsterRef(monsterName: string | undefined): boolean {
    return Boolean(monsterName?.startsWith(AURORA_MONSTER_PREFIX));
}

export function isFc5MonsterRef(monsterName: string | undefined): boolean {
    return Boolean(monsterName?.startsWith(FC5_MONSTER_PREFIX));
}

export function auroraIdFromRef(monsterName: string): string {
    return monsterName.startsWith(AURORA_MONSTER_PREFIX)
        ? monsterName.slice(AURORA_MONSTER_PREFIX.length)
        : monsterName;
}

export function fc5IdFromRef(monsterName: string): string {
    return monsterName.startsWith(FC5_MONSTER_PREFIX)
        ? monsterName.slice(FC5_MONSTER_PREFIX.length)
        : monsterName;
}
