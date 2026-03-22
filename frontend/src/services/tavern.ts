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

export type TavernEffectJson =
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;

export interface TavernOptionDefinition {
    id: number;
    campaign_id: number;
    name: string;
    description: string | null;
    purchase_cost_gp: number;
    setup_days: number;
    effect_json: TavernEffectJson;
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
    valuation_bonus: number;
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

export interface TavernCatalogFile {
    version: number;
    catalog_name?: string;
    definitions: Array<{
        name: string;
        description?: string | null;
        purchase_cost_gp?: number;
        setup_days?: number;
        effect_json?: TavernEffectJson;
        sort_order?: number;
        is_archived?: boolean;
        group?: string | null;
    }>;
}

export interface TavernCatalogImportResult {
    bundle: TavernBundle;
    added: number;
    skipped: number;
}

export interface TavernBusinessTableRowRef {
    result_band: string;
    row_id: string;
    label_de: string;
    label_en: string;
    effect_dice: string;
    dice_to_roll: string;
    sum_range: string;
    outcome: string;
    narrative_hint: string | null;
}

export interface TavernBusinessTableResponse {
    formula_de: string;
    formula_en: string;
    rows: TavernBusinessTableRowRef[];
}

export interface TavernBusinessPreview {
    d100_roll: number;
    check_total: number;
    modifier_breakdown: Record<string, number>;
    row_id: string;
    label_de: string;
    label_en: string;
    effect_dice: string;
    dice_to_roll_de: string;
    d10_count: number;
    outcome: string;
    instruction_de: string;
    instruction_en: string;
    effect_dice_sum_min: number;
    effect_dice_sum_max: number;
    narrative_hint: string | null;
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

    async getBusinessTable(campaignId: number): Promise<TavernBusinessTableResponse> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/business-table`, {
            headers: headers(),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async previewBusinessTable(campaignId: number, d100_roll: number): Promise<TavernBusinessPreview> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/business-table-preview`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ d100_roll }),
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

    async resetSimulation(campaignId: number): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/reset`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({}),
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
            effect_json?: TavernEffectJson;
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
            effect_json: TavernEffectJson;
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
            raw_table_gp?: number;
            is_profit?: boolean;
            manual_adjustment_gp?: number;
            apply: boolean;
            use_business_table?: boolean;
            effect_dice_sum?: number | null;
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

    async exportCatalog(campaignId: number, catalogName?: string): Promise<TavernCatalogFile> {
        const q =
            catalogName != null && catalogName !== ''
                ? `?catalog_name=${encodeURIComponent(catalogName)}`
                : '';
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/catalog-export${q}`, {
            headers: headers(),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async importCatalog(
        campaignId: number,
        payload: {
            mode: 'append' | 'replace_all';
            definitions: TavernCatalogFile['definitions'];
            catalog_name?: string | null;
        }
    ): Promise<TavernCatalogImportResult> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/catalog-import`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async createLedgerEntry(
        campaignId: number,
        body: { settled_day: number; net_change_gp: number; note?: string | null }
    ): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/ledger`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async patchLedgerEntry(
        campaignId: number,
        entryId: number,
        body: {
            settled_day?: number;
            net_change_gp?: number;
            payload_json?: Record<string, unknown>;
        }
    ): Promise<TavernBundle> {
        const res = await fetch(
            `${base()}/campaigns/${campaignId}/tavern/ledger/${entryId}`,
            {
                method: 'PATCH',
                headers: headers(),
                body: JSON.stringify(body),
            }
        );
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async deleteLedgerEntry(campaignId: number, entryId: number): Promise<TavernBundle> {
        const res = await fetch(`${base()}/campaigns/${campaignId}/tavern/ledger/${entryId}`, {
            method: 'DELETE',
            headers: headers(false),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },
};
