export interface DiePool {
    count: number;
    faces: number;
}

export interface ParsedDiceExpression {
    pools: DiePool[];
    modifier: number;
}

const DICE_TOKEN_REGEX = /([+-]?\d+d\d+|[+-]?\d+)/gi;

export function parseDiceExpression(expression: string): ParsedDiceExpression {
    const normalized = expression.trim().replace(/\s/g, '');
    if (!normalized) {
        throw new Error('Empty expression');
    }

    const tokens = normalized.match(DICE_TOKEN_REGEX);
    if (!tokens) {
        throw new Error(`Invalid expression: ${expression}`);
    }

    const pools: DiePool[] = [];
    let modifier = 0;

    for (const token of tokens) {
        const diceMatch = token.match(/^([+-]?)(\d+)d(\d+)$/i);
        if (diceMatch) {
            const [, sign, countStr, facesStr] = diceMatch;
            const count = parseInt(countStr, 10);
            const faces = parseInt(facesStr, 10);
            if (count <= 0 || faces <= 0) {
                throw new Error(`Dice must be positive: ${token}`);
            }
            if (sign === '-') {
                throw new Error(`Negative dice are not allowed: ${token}`);
            }
            pools.push({ count, faces });
        } else {
            modifier += parseInt(token, 10);
        }
    }

    return { pools, modifier };
}

function rollDie(faces: number): number {
    return Math.floor(Math.random() * faces) + 1;
}

export function rollDiceExpression(expression: string): number {
    const { pools, modifier } = parseDiceExpression(expression);
    let total = modifier;

    for (const pool of pools) {
        for (let i = 0; i < pool.count; i++) {
            total += rollDie(pool.faces);
        }
    }

    return Math.max(1, total);
}

export function parseInitiativeModifier(input: string): number {
    const trimmed = input.trim();
    if (!trimmed) {
        throw new Error('Empty initiative modifier');
    }

    const value = parseInt(trimmed, 10);
    if (Number.isNaN(value)) {
        throw new Error(`Invalid initiative modifier: ${input}`);
    }

    return value;
}

export function rollInitiative(modifier: number): number {
    return rollDie(20) + modifier;
}

export function isDiceExpression(input: string): boolean {
    return /d/i.test(input.trim());
}

export function resolveHP(input: string): number | undefined {
    const trimmed = input.trim();
    if (!trimmed) {
        return undefined;
    }

    if (isDiceExpression(trimmed)) {
        return rollDiceExpression(trimmed);
    }

    const value = parseInt(trimmed, 10);
    if (Number.isNaN(value)) {
        throw new Error(`Invalid HP: ${input}`);
    }

    return value;
}

export function resolveInitiative(input: string): number {
    const trimmed = input.trim();
    if (!trimmed) {
        throw new Error('Empty initiative');
    }

    if (/^[+-]/.test(trimmed)) {
        return rollInitiative(parseInitiativeModifier(trimmed));
    }

    const value = parseInt(trimmed, 10);
    if (Number.isNaN(value)) {
        throw new Error(`Invalid initiative: ${input}`);
    }

    return value;
}
