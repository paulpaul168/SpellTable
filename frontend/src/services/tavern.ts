import { authService } from '@/services/auth';
import { getApiUrl } from '@/utils/api';

const base = () => getApiUrl();

export interface TavernState {
    id: number;
    campaign_id: number;
    current_day: number;
    valuation: number;
    condition: string;
    situational_business_bonus: number;
    treasury_gp: number;
    days_per_tenday: number;
    created_at: string;
    updated_at: string;
}

export interface TavernOptionDefinition {
    id: number;
    campaign_id: number;
    name: string;
    description: string | null;
    purchase_cost_gp: number;
    setup_days: number;
    effect_json: Record<string, unknown> | null;
    sort_order: number;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
}

export interface TavernOptionInstance {
    id: number;
    campaign_id: number;
    definition_id: number;
    status: string;
    purchased_on_day: number;
    activates_on_day: number;
    created_at: string;
    updated_at: string;
}

export interface TavernActiveEffects {
    fixed_income_gp_per_tenday: number;
    recurring_cost_gp_per_tenday: number;
    business_roll_bonus: number;
    flags: string[];
}

export interface TavernLedgerEntry {
    id: number;
    campaign_id: number;
    settled_day: number;
    payload_json: Record<string, unknown>;
    net_change_gp: number;
    created_at: string;
}

export interface TavernBundle {
    state: TavernState;
    definitions: TavernOptionDefinition[];
    instances: TavernOptionInstance[];
    active_effects: TavernActiveEffects;
    multipliers: { profit: number; loss: number };
    ledger: TavernLedgerEntry[];
}

export interface TavernSettleResult {
    preview: Record<string, unknown>;
    treasury_gp_after: number | null;
    ledger_entry: TavernLedgerEntry | null;
}

function headers(json = true): HeadersInit {
    const h: Record<string, string> = {
        ...authService.getAuthHeader(),
    };
    if (json) {
        h['Content-Type'] = 'application/json';
    }
    return h;
}

async function parseError(res: Response): Promise<string> {
    try {
        const j = await res.json();
        return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
        return res.statusText;
    }
}

export const tavernService = {
    async getBundle(campaignId: number): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern`, {
            headers: headers(),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async updateState(
        campaignId: number,
        body: Partial<{
            current_day: number;
            valuation: number;
            condition: string;
            situational_business_bonus: number;
            treasury_gp: number;
            days_per_tenday: number;
        }>
    ): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/state`, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async advanceDays(campaignId: number, days: number): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/advance-days`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ days }),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async createDefinition(
        campaignId: number,
        body: {
            name: string;
            description?: string | null;
            purchase_cost_gp?: number;
            setup_days?: number;
            effect_json?: Record<string, unknown> | null;
            sort_order?: number;
        }
    ): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/definitions`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async updateDefinition(
        campaignId: number,
        definitionId: number,
        body: Partial<{
            name: string;
            description: string | null;
            purchase_cost_gp: number;
            setup_days: number;
            effect_json: Record<string, unknown> | null;
            sort_order: number;
            is_archived: boolean;
        }>
    ): Promise<TavernBundle> {
        const res = await fetch(
            `${base()}/campaigns/${campaignId}/tavern/definitions/${definitionId}`,
            {
                method: 'PUT',
                headers: headers(),
                body: JSON.stringify(body),
            }
        );
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async createInstance(campaignId: number, definitionId: number): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/instances`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ definition_id: definitionId }),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async patchInstance(campaignId: number, instanceId: number, status: string): Promise<TavernBundle> {
        const res = await fetch(
            `${base()}/campaigns/${campaignId}/tavern/instances/${instanceId}`,
            {
                method: 'PATCH',
                headers: headers(),
                body: JSON.stringify({ status }),
            }
        );
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async settleTenday(
        campaignId: number,
        body: {
            d100_roll?: number | null;
            raw_table_gp: number;
            is_profit: boolean;
            manual_adjustment_gp?: number;
            apply: boolean;
        }
    ): Promise<TavernSettleResult> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/settle-tenday`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },
};
