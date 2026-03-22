'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Campaign } from '@/components/CampaignManagement';
import {
    tavernService,
    TavernBundle,
    TavernBusinessPreview,
    TavernBusinessTableResponse,
    TavernCatalogFile,
    TavernEffectJson,
    TavernLedgerEntry,
    TavernOptionDefinition,
    TavernOptionInstance,
} from '@/services/tavern';

const CONDITIONS = [
    { value: 'squalid', label: 'Squalid (profit ×1, loss ×3)' },
    { value: 'poor', label: 'Poor (×3 / ×4)' },
    { value: 'modest', label: 'Modest (×5 / ×5)' },
    { value: 'comfortable', label: 'Comfortable (×7 / ×6)' },
    { value: 'wealthy', label: 'Wealthy (×9 / ×8)' },
    { value: 'aristocratic', label: 'Aristocratic (×12 / ×10)' },
] as const;

const EFFECT_EXAMPLE = `[{"kind":"fixed_income_gp_per_tenday","amount":60}]`;

interface TavernTabProps {
    campaign: Campaign;
    isAdmin: boolean;
}

export function TavernTab({ campaign, isAdmin }: TavernTabProps) {
    const { toast } = useToast();
    const [bundle, setBundle] = useState<TavernBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editCurrentDay, setEditCurrentDay] = useState('');
    const [editValuation, setEditValuation] = useState('');
    const [editCondition, setEditCondition] = useState('modest');
    const [editSituational, setEditSituational] = useState('');
    const [editTreasury, setEditTreasury] = useState('');
    const [editDaysPerTenday, setEditDaysPerTenday] = useState('10');
    const [advanceBy, setAdvanceBy] = useState('1');

    const [defDialogOpen, setDefDialogOpen] = useState(false);
    const [editingDef, setEditingDef] = useState<TavernOptionDefinition | null>(null);
    const [defName, setDefName] = useState('');
    const [defDesc, setDefDesc] = useState('');
    const [defCost, setDefCost] = useState('0');
    const [defSetup, setDefSetup] = useState('0');
    const [defEffect, setDefEffect] = useState(EFFECT_EXAMPLE);
    const [defSort, setDefSort] = useState('0');
    const [defArchived, setDefArchived] = useState(false);

    const [settleD100, setSettleD100] = useState('');
    const [settleD10Sum, setSettleD10Sum] = useState('');
    const [settleRaw, setSettleRaw] = useState('');
    const [settleProfit, setSettleProfit] = useState(true);
    const [settleManual, setSettleManual] = useState('0');
    const [settlePreview, setSettlePreview] = useState<Record<string, unknown> | null>(null);
    const [rollPreview, setRollPreview] = useState<TavernBusinessPreview | null>(null);
    const [rollLookupLoading, setRollLookupLoading] = useState(false);
    const [businessTable, setBusinessTable] = useState<TavernBusinessTableResponse | null>(null);
    const [useBusinessTable, setUseBusinessTable] = useState(true);
    const [importText, setImportText] = useState('');
    const importFileRef = useRef<HTMLInputElement>(null);

    const [catalogFilter, setCatalogFilter] = useState('');
    const [purchaseFilter, setPurchaseFilter] = useState('');

    const [ledgerEditOpen, setLedgerEditOpen] = useState(false);
    const [ledgerEditTarget, setLedgerEditTarget] = useState<TavernLedgerEntry | null>(null);
    const [ledgerEditDay, setLedgerEditDay] = useState('');
    const [ledgerEditNet, setLedgerEditNet] = useState('');

    const [ledgerManualOpen, setLedgerManualOpen] = useState(false);
    const [ledgerManualDay, setLedgerManualDay] = useState('');
    const [ledgerManualNet, setLedgerManualNet] = useState('');
    const [ledgerManualNote, setLedgerManualNote] = useState('');

    /** Viewer: catalog / purchase row opens detail modal */
    const [viewerOptionDetail, setViewerOptionDetail] = useState<{
        def: TavernOptionDefinition;
        subtitle?: string;
    } | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const b = await tavernService.getBundle(campaign.id);
            setBundle(b);
            setEditCurrentDay(String(b.state.current_day));
            setEditValuation(String(b.state.valuation));
            setEditCondition(b.state.condition);
            setEditSituational(String(b.state.situational_business_bonus));
            setEditTreasury(String(b.state.treasury_gp));
            setEditDaysPerTenday(String(b.state.days_per_tenday));
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Failed to load tavern',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [campaign.id, toast]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const t = await tavernService.getBusinessTable(campaign.id);
                if (!cancelled) setBusinessTable(t);
            } catch {
                if (!cancelled) setBusinessTable(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [campaign.id]);

    useEffect(() => {
        if (!useBusinessTable) {
            setRollPreview(null);
            setSettleD10Sum('');
        }
    }, [useBusinessTable]);

    const defById = useMemo(() => {
        const m = new Map<number, TavernOptionDefinition>();
        bundle?.definitions.forEach((d) => m.set(d.id, d));
        return m;
    }, [bundle?.definitions]);

    const filteredCatalogDefs = useMemo(() => {
        const q = catalogFilter.trim().toLowerCase();
        if (!bundle) return [];
        return bundle.definitions.filter((d) => {
            if (!q) return true;
            return `${d.name} ${d.description ?? ''}`.toLowerCase().includes(q);
        });
    }, [bundle, catalogFilter]);

    const filteredInstances = useMemo(() => {
        const q = purchaseFilter.trim().toLowerCase();
        if (!bundle) return [];
        return bundle.instances.filter((i) => {
            if (!q) return true;
            const name = defById.get(i.definition_id)?.name ?? '';
            return `${name} ${i.status} ${i.id}`.toLowerCase().includes(q);
        });
    }, [bundle, purchaseFilter, defById]);

    const syncFormsFromBundle = (b: TavernBundle) => {
        setEditCurrentDay(String(b.state.current_day));
        setEditValuation(String(b.state.valuation));
        setEditCondition(b.state.condition);
        setEditSituational(String(b.state.situational_business_bonus));
        setEditTreasury(String(b.state.treasury_gp));
        setEditDaysPerTenday(String(b.state.days_per_tenday));
    };

    const handleSaveState = async () => {
        if (!isAdmin) return;
        try {
            setSaving(true);
            const b = await tavernService.updateState(campaign.id, {
                current_day: Math.max(0, parseInt(editCurrentDay, 10) || 0),
                valuation: parseInt(editValuation, 10) || 0,
                condition: editCondition,
                situational_business_bonus: parseInt(editSituational, 10) || 0,
                treasury_gp: parseInt(editTreasury, 10) || 0,
                days_per_tenday: Math.max(1, parseInt(editDaysPerTenday, 10) || 10),
            });
            setBundle(b);
            syncFormsFromBundle(b);
            toast({ title: 'Saved', description: 'Tavern state updated.' });
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Save failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAdvance = async (daysOverride?: number) => {
        if (!isAdmin) return;
        const n =
            daysOverride ?? Math.max(1, parseInt(advanceBy, 10) || 1);
        try {
            setSaving(true);
            const b = await tavernService.advanceDays(campaign.id, n);
            setBundle(b);
            syncFormsFromBundle(b);
            toast({ title: 'Time advanced', description: `+${n} day(s).` });
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Advance failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const openNewDef = () => {
        setEditingDef(null);
        setDefName('');
        setDefDesc('');
        setDefCost('0');
        setDefSetup('0');
        setDefEffect(EFFECT_EXAMPLE);
        setDefSort('0');
        setDefArchived(false);
        setDefDialogOpen(true);
    };

    const openEditDef = (d: TavernOptionDefinition) => {
        setEditingDef(d);
        setDefName(d.name);
        setDefDesc(d.description ?? '');
        setDefCost(String(d.purchase_cost_gp));
        setDefSetup(String(d.setup_days));
        setDefEffect(
            d.effect_json ? JSON.stringify(d.effect_json, null, 2) : EFFECT_EXAMPLE
        );
        setDefSort(String(d.sort_order));
        setDefArchived(d.is_archived);
        setDefDialogOpen(true);
    };

    const submitDefinition = async () => {
        let effect: TavernEffectJson = null;
        const trimmed = defEffect.trim();
        if (trimmed) {
            try {
                const parsed: unknown = JSON.parse(trimmed);
                if (parsed !== null && typeof parsed === 'object') {
                    effect = parsed as TavernEffectJson;
                } else {
                    throw new Error('effect_json must be an object or array');
                }
            } catch {
                toast({
                    title: 'Invalid JSON',
                    description: 'Fix effect_json before saving.',
                    variant: 'destructive',
                });
                return;
            }
        }
        try {
            setSaving(true);
            let b: TavernBundle;
            if (editingDef) {
                b = await tavernService.updateDefinition(campaign.id, editingDef.id, {
                    name: defName.trim(),
                    description: defDesc.trim() || null,
                    purchase_cost_gp: parseInt(defCost, 10) || 0,
                    setup_days: parseInt(defSetup, 10) || 0,
                    effect_json: effect,
                    sort_order: parseInt(defSort, 10) || 0,
                    is_archived: defArchived,
                });
            } else {
                b = await tavernService.createDefinition(campaign.id, {
                    name: defName.trim(),
                    description: defDesc.trim() || null,
                    purchase_cost_gp: parseInt(defCost, 10) || 0,
                    setup_days: parseInt(defSetup, 10) || 0,
                    effect_json: effect,
                    sort_order: parseInt(defSort, 10) || 0,
                });
            }
            setBundle(b);
            setDefDialogOpen(false);
            toast({
                title: editingDef ? 'Updated' : 'Created',
                description: 'Catalog option saved.',
            });
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Save failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const purchase = async (definitionId: number) => {
        try {
            setSaving(true);
            const b = await tavernService.createInstance(campaign.id, definitionId);
            setBundle(b);
            toast({ title: 'Recorded', description: 'Purchase / unlock started (setup time applies).' });
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const cancelInstance = async (instanceId: number) => {
        try {
            setSaving(true);
            const b = await tavernService.patchInstance(campaign.id, instanceId, 'cancelled');
            setBundle(b);
            toast({ title: 'Cancelled', description: 'Option instance cancelled.' });
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const openLedgerEdit = (e: TavernLedgerEntry) => {
        setLedgerEditTarget(e);
        setLedgerEditDay(String(e.settled_day));
        setLedgerEditNet(String(e.net_change_gp));
        setLedgerEditOpen(true);
    };

    const saveLedgerEdit = async () => {
        if (!ledgerEditTarget || !isAdmin) return;
        const day = parseInt(ledgerEditDay, 10);
        const net = parseInt(ledgerEditNet, 10);
        if (Number.isNaN(day) || day < 0) {
            toast({ title: 'Invalid day', description: 'Use a non-negative campaign day.', variant: 'destructive' });
            return;
        }
        if (Number.isNaN(net)) {
            toast({ title: 'Invalid amount', description: 'Net change must be a whole number (gp).', variant: 'destructive' });
            return;
        }
        try {
            setSaving(true);
            const b = await tavernService.patchLedgerEntry(campaign.id, ledgerEditTarget.id, {
                settled_day: day,
                net_change_gp: net,
            });
            setBundle(b);
            syncFormsFromBundle(b);
            setLedgerEditOpen(false);
            setLedgerEditTarget(null);
            toast({ title: 'Ledger updated', description: 'Treasury adjusted if net amount changed.' });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const removeLedgerEntry = async (e: TavernLedgerEntry) => {
        if (!isAdmin) return;
        if (
            !window.confirm(
                `Remove ledger line (day ${e.settled_day}, ${e.net_change_gp >= 0 ? '+' : ''}${e.net_change_gp} gp)? Treasury will be adjusted.`
            )
        ) {
            return;
        }
        try {
            setSaving(true);
            const b = await tavernService.deleteLedgerEntry(campaign.id, e.id);
            setBundle(b);
            syncFormsFromBundle(b);
            toast({ title: 'Removed', description: 'Ledger entry deleted; treasury updated.' });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const saveManualLedger = async () => {
        if (!isAdmin) return;
        const day = parseInt(ledgerManualDay, 10);
        const net = parseInt(ledgerManualNet, 10);
        if (Number.isNaN(day) || day < 0) {
            toast({ title: 'Invalid day', description: 'Use a non-negative campaign day.', variant: 'destructive' });
            return;
        }
        if (Number.isNaN(net)) {
            toast({ title: 'Invalid amount', description: 'Net change must be a whole number (gp).', variant: 'destructive' });
            return;
        }
        try {
            setSaving(true);
            const b = await tavernService.createLedgerEntry(campaign.id, {
                settled_day: day,
                net_change_gp: net,
                note: ledgerManualNote.trim() || undefined,
            });
            setBundle(b);
            syncFormsFromBundle(b);
            setLedgerManualOpen(false);
            setLedgerManualDay('');
            setLedgerManualNet('');
            setLedgerManualNote('');
            toast({ title: 'Ledger line added', description: 'Treasury updated.' });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const downloadCatalogExport = async () => {
        if (!isAdmin) return;
        try {
            setSaving(true);
            const data = await tavernService.exportCatalog(campaign.id, campaign.name);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `tavern-catalog-${campaign.name.replace(/\s+/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast({ title: 'Exported', description: 'Catalog JSON downloaded.' });
        } catch (e) {
            toast({
                title: 'Export failed',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const loadPhandalinPreset = async () => {
        try {
            setSaving(true);
            const res = await fetch('/tavern-seeds/phandalin-tresendar-manor.json');
            if (!res.ok) throw new Error('Preset file not found');
            const data = (await res.json()) as TavernCatalogFile;
            setImportText(JSON.stringify(data, null, 2));
            toast({
                title: 'Preset loaded',
                description: data.catalog_name ?? `${data.definitions?.length ?? 0} definitions`,
            });
        } catch (e) {
            toast({
                title: 'Could not load preset',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const runCatalogImport = async (mode: 'append' | 'replace_all') => {
        if (!isAdmin) return;
        let parsed: TavernCatalogFile;
        try {
            parsed = JSON.parse(importText) as TavernCatalogFile;
        } catch {
            toast({
                title: 'Invalid JSON',
                description: 'Paste valid catalog JSON or load a preset.',
                variant: 'destructive',
            });
            return;
        }
        if (!parsed.definitions || !Array.isArray(parsed.definitions)) {
            toast({
                title: 'Invalid catalog',
                description: 'Root must include a definitions array.',
                variant: 'destructive',
            });
            return;
        }
        if (
            mode === 'replace_all' &&
            !window.confirm(
                'Replace entire catalog? All purchased instances (progress) are removed. Continue?'
            )
        ) {
            return;
        }
        try {
            setSaving(true);
            const result = await tavernService.importCatalog(campaign.id, {
                mode,
                definitions: parsed.definitions,
                catalog_name: parsed.catalog_name,
            });
            setBundle(result.bundle);
            syncFormsFromBundle(result.bundle);
            toast({
                title: 'Import complete',
                description: `Added ${result.added} definition(s), skipped ${result.skipped}.`,
            });
        } catch (e) {
            toast({
                title: 'Import failed',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            setImportText(String(reader.result ?? ''));
            toast({ title: 'File read', description: f.name });
        };
        reader.readAsText(f);
        e.target.value = '';
    };

    const fetchRollPreview = async () => {
        const d100s = settleD100.trim();
        const d = parseInt(d100s, 10);
        if (Number.isNaN(d) || d < 1 || d > 100) {
            toast({
                title: 'd100',
                description: 'Enter 1–100 for the business check first.',
                variant: 'destructive',
            });
            return;
        }
        try {
            setRollLookupLoading(true);
            const p = await tavernService.previewBusinessTable(campaign.id, d);
            setRollPreview(p);
            if (p.d10_count === 0) {
                setSettleD10Sum('0');
            }
            toast({ title: 'Row found', description: `${p.label_de} — roll ${p.dice_to_roll_de}` });
        } catch (e) {
            toast({
                title: 'Lookup failed',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            });
        } finally {
            setRollLookupLoading(false);
        }
    };

    const runSettle = async (apply: boolean) => {
        const manualAdj = parseInt(settleManual, 10) || 0;
        let payload: Parameters<typeof tavernService.settleTenday>[1];

        if (useBusinessTable) {
            const d100s = settleD100.trim();
            const d = parseInt(d100s, 10);
            if (Number.isNaN(d) || d < 1 || d > 100) {
                toast({
                    title: 'd100 required',
                    description: 'Enter 1–100 for the business check (Wurf pro Tenday).',
                    variant: 'destructive',
                });
                return;
            }
            const sumRaw = settleD10Sum.trim();
            const effectSum = parseInt(sumRaw, 10);
            if (Number.isNaN(effectSum) || effectSum < 0) {
                toast({
                    title: 'Sum of d10',
                    description: 'Enter the total of your d10 rolls (0 for break-even row).',
                    variant: 'destructive',
                });
                return;
            }
            payload = {
                d100_roll: d,
                use_business_table: true,
                effect_dice_sum: effectSum,
                raw_table_gp: 0,
                is_profit: true,
                manual_adjustment_gp: manualAdj,
                apply,
            };
        } else {
            const raw = parseInt(settleRaw, 10);
            if (Number.isNaN(raw) || raw < 0) {
                toast({
                    title: 'Invalid raw GP',
                    description: 'Enter a non-negative raw value (manual mode).',
                    variant: 'destructive',
                });
                return;
            }
            const d100s = settleD100.trim();
            let d100: number | null | undefined;
            if (d100s !== '') {
                const d = parseInt(d100s, 10);
                if (Number.isNaN(d) || d < 1 || d > 100) {
                    toast({
                        title: 'Invalid d100',
                        description: 'Use 1–100 or leave empty.',
                        variant: 'destructive',
                    });
                    return;
                }
                d100 = d;
            } else {
                d100 = null;
            }
            payload = {
                d100_roll: d100,
                use_business_table: false,
                raw_table_gp: raw,
                is_profit: settleProfit,
                manual_adjustment_gp: manualAdj,
                apply,
            };
        }
        try {
            setSaving(true);
            const result = await tavernService.settleTenday(campaign.id, payload);
            setSettlePreview(result.preview);
            if (apply && bundle) {
                const b = await tavernService.getBundle(campaign.id);
                setBundle(b);
                syncFormsFromBundle(b);
            }
            toast({
                title: apply ? 'Applied' : 'Preview',
                description: apply
                    ? `Treasury now ${result.treasury_gp_after ?? '—'} gp`
                    : 'Review breakdown below.',
            });
        } catch (e) {
            toast({
                title: 'Error',
                description: e instanceof Error ? e.message : 'Settlement failed',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !bundle) {
        return (
            <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto mb-2" />
                Loading tavern…
            </div>
        );
    }

    const { state, active_effects, multipliers, ledger } = bundle;
    const vBonus = active_effects.valuation_bonus ?? 0;
    const dpt = Math.max(1, state.days_per_tenday);
    const dayInTenday = (state.current_day % dpt) + 1;
    const tendayIndex = Math.floor(state.current_day / dpt) + 1;
    const staticCheckBonus =
        state.valuation +
        vBonus +
        state.situational_business_bonus +
        active_effects.business_roll_bonus;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tavern</h2>
                {!isAdmin && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Read-only (DM uses admin account)</p>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                    <CardHeader>
                        <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Campaign day:</span>{' '}
                            <strong>{state.current_day}</strong>
                        </p>
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Tenday:</span> #{tendayIndex},{' '}
                            day {dayInTenday} of {dpt}
                        </p>
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Valuation (base):</span>{' '}
                            {state.valuation}
                            {vBonus !== 0 && (
                                <span className="text-zinc-500">
                                    {' '}
                                    + active upgrades: +{vBonus} → effective{' '}
                                    <strong>{state.valuation + vBonus}</strong>
                                </span>
                            )}
                        </p>
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Condition:</span>{' '}
                            {state.condition} — profit ×{multipliers.profit}, loss ×{multipliers.loss}
                        </p>
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Situational bonus:</span>{' '}
                            +{state.situational_business_bonus} (e.g. Cobbled Street)
                        </p>
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Treasury:</span>{' '}
                            <strong>{state.treasury_gp} gp</strong>
                        </p>
                        <p>
                            <span className="text-zinc-500 dark:text-zinc-400">Active effects:</span> fixed +
                            {active_effects.fixed_income_gp_per_tenday} gp/tenday, recurring −
                            {active_effects.recurring_cost_gp_per_tenday} gp/tenday, valuation +
                            {vBonus}, roll +{active_effects.business_roll_bonus}
                        </p>
                        {active_effects.flags.length > 0 && (
                            <p>
                                <span className="text-zinc-500 dark:text-zinc-400">Flags:</span>{' '}
                                {active_effects.flags.join(', ')}
                            </p>
                        )}
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-600">
                            Business check (if you roll d100): d100 + valuation ({state.valuation}
                            {vBonus ? ` + ${vBonus} from upgrades` : ''}) + situational (
                            {state.situational_business_bonus}) + roll bonuses (
                            {active_effects.business_roll_bonus}) = d100 + {staticCheckBonus}
                        </p>
                    </CardContent>
                </Card>

                {isAdmin && (
                    <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                        <CardHeader>
                            <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">DM controls</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label>Campaign day</Label>
                                    <Input
                                        value={editCurrentDay}
                                        onChange={(e) => setEditCurrentDay(e.target.value)}
                                        className="border-zinc-200 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Valuation</Label>
                                    <Input
                                        value={editValuation}
                                        onChange={(e) => setEditValuation(e.target.value)}
                                        className="border-zinc-200 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Treasury (gp)</Label>
                                    <Input
                                        value={editTreasury}
                                        onChange={(e) => setEditTreasury(e.target.value)}
                                        className="border-zinc-200 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Situational bonus</Label>
                                    <Input
                                        value={editSituational}
                                        onChange={(e) => setEditSituational(e.target.value)}
                                        className="border-zinc-200 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Days per tenday</Label>
                                    <Input
                                        value={editDaysPerTenday}
                                        onChange={(e) => setEditDaysPerTenday(e.target.value)}
                                        className="border-zinc-200 dark:border-zinc-700"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Condition</Label>
                                <Select value={editCondition} onValueChange={setEditCondition}>
                                    <SelectTrigger className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONDITIONS.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleSaveState}
                                disabled={saving}
                                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                            >
                                Save state
                            </Button>
                            <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-600">
                                <div className="space-y-1">
                                    <Label>Advance days</Label>
                                    <Input
                                        value={advanceBy}
                                        onChange={(e) => setAdvanceBy(e.target.value)}
                                        className="w-24 border-zinc-200 dark:border-zinc-700"
                                    />
                                </div>
                                <Button variant="outline" onClick={() => void handleAdvance()} disabled={saving}>
                                    Advance
                                </Button>
                                <Button variant="outline" onClick={() => void handleAdvance(1)} disabled={saving}>
                                    +1 day
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {isAdmin && (
                <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                    <CardHeader>
                        <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">
                            Catalog import / export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Export current catalog as JSON. Import appends new names or replaces everything
                            (clears purchases). effect_json can be one object or an array of objects.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={downloadCatalogExport} disabled={saving}>
                                Export catalog JSON
                            </Button>
                            <Button type="button" variant="outline" onClick={loadPhandalinPreset} disabled={saving}>
                                Load Phandalin / Tresendar preset
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => importFileRef.current?.click()}
                                disabled={saving}
                            >
                                Choose JSON file…
                            </Button>
                            <input
                                ref={importFileRef}
                                type="file"
                                accept="application/json,.json"
                                className="hidden"
                                onChange={onImportFile}
                            />
                        </div>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder='Paste catalog JSON here (must include "definitions" array)…'
                            className="w-full min-h-[120px] p-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" onClick={() => void runCatalogImport('append')} disabled={saving}>
                                Import (append)
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => void runCatalogImport('replace_all')}
                                disabled={saving}
                            >
                                Import (replace all)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
                    <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Catalog & purchases</CardTitle>
                    {isAdmin && (
                        <Button size="sm" onClick={openNewDef} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 shrink-0">
                            + New option
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-5">
                    {isAdmin ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            effect_json: fixed_income / recurring_cost / roll & valuation bonuses / flags — edit options
                            in the dialog.
                        </p>
                    ) : (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Tap a catalog or purchase row to read the full description.
                        </p>
                    )}

                    <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                            <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Catalog</h3>
                            <Input
                                value={catalogFilter}
                                onChange={(e) => setCatalogFilter(e.target.value)}
                                placeholder="Search catalog…"
                                className="sm:max-w-xs border-zinc-200 dark:border-zinc-700 h-9 text-sm"
                            />
                        </div>
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 max-h-52 overflow-y-auto">
                            {bundle.definitions.length === 0 ? (
                                <p className="text-zinc-500 text-sm p-3">No catalog entries yet.</p>
                            ) : filteredCatalogDefs.length === 0 ? (
                                <p className="text-zinc-500 text-sm p-3">No matches.</p>
                            ) : (
                                <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                                    {filteredCatalogDefs.map((d) => (
                                        <li key={d.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                            {isAdmin ? (
                                                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between w-full px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                            {d.name}
                                                            {d.is_archived && (
                                                                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">
                                                                    archived
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 tabular-nums">
                                                            {d.purchase_cost_gp} gp · {d.setup_days}d setup
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 gap-1.5">
                                                        <Button size="sm" variant="outline" className="h-8" onClick={() => openEditDef(d)}>
                                                            Edit
                                                        </Button>
                                                        {!d.is_archived && (
                                                            <Button size="sm" className="h-8" onClick={() => purchase(d.id)} disabled={saving}>
                                                                Buy
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewerOptionDetail({ def: d })}
                                                    className="w-full text-left flex flex-col gap-1 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 rounded-sm"
                                                >
                                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                                        {d.name}
                                                        {d.is_archived && (
                                                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">
                                                                archived
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 tabular-nums">
                                                        {d.purchase_cost_gp} gp · {d.setup_days}d setup
                                                    </div>
                                                    {d.description?.trim() && (
                                                        <div className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                                                            {d.description}
                                                        </div>
                                                    )}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400">
                            Showing {filteredCatalogDefs.length} of {bundle.definitions.length}
                        </p>
                    </div>

                    <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-600 pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                            <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Purchased / upgrades</h3>
                            <Input
                                value={purchaseFilter}
                                onChange={(e) => setPurchaseFilter(e.target.value)}
                                placeholder="Search purchases…"
                                className="sm:max-w-xs border-zinc-200 dark:border-zinc-700 h-9 text-sm"
                            />
                        </div>
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 max-h-40 overflow-y-auto">
                            {bundle.instances.length === 0 ? (
                                <p className="text-zinc-500 text-sm p-3">No instances yet.</p>
                            ) : filteredInstances.length === 0 ? (
                                <p className="text-zinc-500 text-sm p-3">No matches.</p>
                            ) : (
                                <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                                    {filteredInstances.map((i: TavernOptionInstance) => {
                                        const defn = defById.get(i.definition_id);
                                        const dn = defn?.name ?? `#${i.definition_id}`;
                                        const pending =
                                            i.status === 'pending_setup' && state.current_day < i.activates_on_day;
                                        const purchaseSubtitle = [
                                            i.status,
                                            `bought day ${i.purchased_on_day}`,
                                            pending
                                                ? `ready day ${i.activates_on_day} (${i.activates_on_day - state.current_day}d left)`
                                                : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ');
                                        return (
                                            <li
                                                key={i.id}
                                                className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                {isAdmin ? (
                                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between w-full px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                                        <span className="text-zinc-800 dark:text-zinc-200 min-w-0">
                                                            <span className="font-medium">{dn}</span>{' '}
                                                            <span className="text-zinc-500">· {i.status}</span>
                                                            {pending && (
                                                                <span className="block text-xs text-zinc-500">
                                                                    Ready day {i.activates_on_day} (
                                                                    {i.activates_on_day - state.current_day}d left)
                                                                </span>
                                                            )}
                                                        </span>
                                                        {i.status !== 'cancelled' && (
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-8 shrink-0"
                                                                onClick={() => cancelInstance(i.id)}
                                                                disabled={saving}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={!defn}
                                                        onClick={() => {
                                                            if (defn) {
                                                                setViewerOptionDetail({
                                                                    def: defn,
                                                                    subtitle: purchaseSubtitle,
                                                                });
                                                            }
                                                        }}
                                                        className="w-full text-left flex flex-col gap-1 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <div>
                                                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                                                {dn}
                                                            </span>
                                                            <span className="text-zinc-500"> · {i.status}</span>
                                                        </div>
                                                        {pending && (
                                                            <span className="text-xs text-zinc-500">
                                                                Ready day {i.activates_on_day} (
                                                                {i.activates_on_day - state.current_day}d left)
                                                            </span>
                                                        )}
                                                        {defn?.description?.trim() && (
                                                            <div className="text-xs text-zinc-500 line-clamp-2">
                                                                {defn.description}
                                                            </div>
                                                        )}
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400">
                            Showing {filteredInstances.length} of {bundle.instances.length}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <CardHeader>
                    <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Tenday settlement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {businessTable && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                            <p>
                                <span className="text-zinc-800 dark:text-zinc-200 font-medium">Check:</span>{' '}
                                {businessTable.formula_de}
                            </p>
                            <p className="text-xs text-zinc-500">{businessTable.formula_en}</p>
                            <details className="rounded-md border border-zinc-200 dark:border-zinc-600 text-xs mt-2">
                                <summary className="cursor-pointer px-3 py-2 bg-zinc-50 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-200 font-medium">
                                    Full results table (reference)
                                </summary>
                                <div className="overflow-x-auto max-h-56 overflow-y-auto border-t border-zinc-200 dark:border-zinc-600">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/80">
                                                <th className="p-2 font-medium text-zinc-800 dark:text-zinc-200">
                                                    Band
                                                </th>
                                                <th className="p-2 font-medium text-zinc-800 dark:text-zinc-200">
                                                    Result
                                                </th>
                                                <th className="p-2 font-medium text-zinc-800 dark:text-zinc-200">
                                                    W10
                                                </th>
                                                <th className="p-2 font-medium text-zinc-800 dark:text-zinc-200">
                                                    Sum
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {businessTable.rows.map((r) => (
                                                <tr
                                                    key={r.row_id}
                                                    className="border-b border-zinc-100 dark:border-zinc-700/80"
                                                >
                                                    <td className="p-2 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                        {r.result_band}
                                                    </td>
                                                    <td className="p-2 text-zinc-800 dark:text-zinc-200">
                                                        {r.label_de}
                                                        <span className="block text-zinc-500">{r.label_en}</span>
                                                    </td>
                                                    <td className="p-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                                        {r.dice_to_roll || '—'}
                                                    </td>
                                                    <td className="p-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                                        {r.sum_range || '—'}
                                                        {r.narrative_hint && (
                                                            <span className="block text-amber-700 dark:text-amber-400 text-[10px] mt-0.5 font-sans">
                                                                {r.narrative_hint}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        </div>
                    )}
                    {!isAdmin && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Enter your d100 below and use <strong>Show what to roll</strong> to see how many d10 to roll
                            and the valid total range.
                        </p>
                    )}
                    {isAdmin && (
                        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                            <input
                                type="checkbox"
                                checked={useBusinessTable}
                                onChange={(e) => setUseBusinessTable(e.target.checked)}
                            />
                            Use business results table (manual d10 sum after lookup)
                        </label>
                    )}
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label>{useBusinessTable ? 'd100 roll' : 'd100 (optional)'}</Label>
                            <Input
                                value={settleD100}
                                onChange={(e) => setSettleD100(e.target.value)}
                                placeholder="1–100"
                                disabled={!isAdmin && !useBusinessTable}
                                className="border-zinc-200 dark:border-zinc-700"
                            />
                        </div>
                        {useBusinessTable && (
                            <>
                                <div className="space-y-1 sm:col-span-1 flex flex-col justify-end">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => void fetchRollPreview()}
                                        disabled={rollLookupLoading}
                                        className="w-full sm:w-auto"
                                    >
                                        {rollLookupLoading ? '…' : 'Show what to roll'}
                                    </Button>
                                </div>
                                {isAdmin && (
                                    <div className="space-y-1">
                                        <Label>Sum of d10 (manual)</Label>
                                        <Input
                                            value={settleD10Sum}
                                            onChange={(e) => setSettleD10Sum(e.target.value)}
                                            placeholder="e.g. 18 (or 0 if break even)"
                                            disabled={!isAdmin}
                                            className="border-zinc-200 dark:border-zinc-700"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                        {!useBusinessTable && isAdmin && (
                            <div className="space-y-1">
                                <Label>Raw table gp</Label>
                                <Input
                                    value={settleRaw}
                                    onChange={(e) => setSettleRaw(e.target.value)}
                                    className="border-zinc-200 dark:border-zinc-700"
                                />
                            </div>
                        )}
                        {isAdmin && (
                            <div className="space-y-1">
                                <Label>Manual adj. (gp)</Label>
                                <Input
                                    value={settleManual}
                                    onChange={(e) => setSettleManual(e.target.value)}
                                    className="border-zinc-200 dark:border-zinc-700"
                                />
                            </div>
                        )}
                        {!useBusinessTable && isAdmin && (
                            <div className="space-y-1 flex items-end">
                                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={settleProfit}
                                        onChange={(e) => setSettleProfit(e.target.checked)}
                                    />
                                    Profit (not loss)
                                </label>
                            </div>
                        )}
                    </div>
                    {rollPreview && useBusinessTable && (
                        <div
                            className={`rounded-lg border p-4 space-y-3 ${
                                settleD100.trim() !== String(rollPreview.d100_roll)
                                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20'
                                    : 'border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/40'
                            }`}
                        >
                            {settleD100.trim() !== String(rollPreview.d100_roll) && (
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                    d100 changed — click &quot;Show what to roll&quot; again to refresh.
                                </p>
                            )}
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="text-sm text-zinc-500 dark:text-zinc-400">Check total</span>
                                <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {rollPreview.check_total}
                                </span>
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                                    {rollPreview.label_de}
                                    <span className="text-zinc-500"> — {rollPreview.label_en}</span>
                                </span>
                            </div>
                            <div className="rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-center">
                                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                                    Roll at the table
                                </p>
                                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                                    {rollPreview.d10_count === 0
                                        ? '—'
                                        : `${rollPreview.d10_count}× d10`}
                                </p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                                    Valid sum of those dice:{' '}
                                    <strong className="tabular-nums">
                                        {rollPreview.effect_dice_sum_min}–{rollPreview.effect_dice_sum_max}
                                    </strong>
                                    {rollPreview.d10_count > 0 && (
                                        <span className="block text-xs text-zinc-500 mt-1">
                                            ({rollPreview.outcome === 'loss' ? 'loss' : 'profit'} raw before condition
                                            multiplier)
                                        </span>
                                    )}
                                </p>
                            </div>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                                {rollPreview.instruction_de}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {rollPreview.instruction_en}
                            </p>
                            {rollPreview.narrative_hint && (
                                <p className="text-xs text-amber-800 dark:text-amber-200">{rollPreview.narrative_hint}</p>
                            )}
                        </div>
                    )}
                    {isAdmin && useBusinessTable && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            DM: after players roll, enter the d10 total above, then preview or apply. Fixed income /
                            recurring costs still apply from upgrades.
                        </p>
                    )}
                    {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() => runSettle(false)}
                                disabled={saving || (useBusinessTable && !settleD10Sum.trim())}
                            >
                                Preview
                            </Button>
                            <Button onClick={() => runSettle(true)} disabled={saving || (useBusinessTable && !settleD10Sum.trim())}>
                                Apply to treasury
                            </Button>
                        </div>
                    )}
                    {settlePreview && (
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-950/40 p-4 text-sm space-y-2 text-zinc-800 dark:text-zinc-200">
                            {(() => {
                                const settlement = settlePreview.settlement as Record<string, unknown> | undefined;
                                const bt = settlePreview.business_table as Record<string, unknown> | undefined;
                                if (!settlement) {
                                    return (
                                        <pre className="text-xs overflow-x-auto">
                                            {JSON.stringify(settlePreview, null, 2)}
                                        </pre>
                                    );
                                }
                                return (
                                    <>
                                        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                            Net:{' '}
                                            <span
                                                className={
                                                    Number(settlement.net_change_gp) >= 0
                                                        ? 'text-green-700 dark:text-green-400'
                                                        : 'text-red-700 dark:text-red-400'
                                                }
                                            >
                                                {Number(settlement.net_change_gp) >= 0 ? '+' : ''}
                                                {String(settlement.net_change_gp)} gp
                                            </span>
                                        </p>
                                        <ul className="text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                                            <li>
                                                Business (after condition):{' '}
                                                <strong className="text-zinc-800 dark:text-zinc-200">
                                                    {String(settlement.business_component_gp)} gp
                                                </strong>{' '}
                                                (raw {String(settlement.raw_table_gp)} × condition)
                                            </li>
                                            <li>Fixed income +{String(settlement.fixed_income_gp_per_tenday)} gp</li>
                                            <li>Recurring −{String(settlement.recurring_cost_gp_per_tenday)} gp</li>
                                            <li>Manual adj. {String(settlement.manual_adjustment_gp)} gp</li>
                                        </ul>
                                        {settlePreview.business_check_total != null && (
                                            <p className="text-xs text-zinc-500">
                                                Check total: {String(settlePreview.business_check_total)}
                                            </p>
                                        )}
                                        {bt && (
                                            <div className="text-xs border-t border-zinc-200 dark:border-zinc-600 pt-2 mt-2 space-y-1">
                                                <p>
                                                    Table: {String(bt.label_de)} — d10 sum entered:{' '}
                                                    {String(bt.effect_dice_sum_entered ?? '—')}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
                    <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Ledger</CardTitle>
                    {isAdmin && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setLedgerManualDay(String(state.current_day));
                                setLedgerManualNet('');
                                setLedgerManualNote('');
                                setLedgerManualOpen(true);
                            }}
                        >
                            Add manual line
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isAdmin && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                            Edit or delete lines to fix mistakes; treasury changes by the difference in net gp. Delete
                            reverses that line’s effect on treasury.
                        </p>
                    )}
                    {ledger.length === 0 ? (
                        <p className="text-zinc-500 text-sm">No settlements recorded.</p>
                    ) : (
                        <ul className="space-y-1 text-sm max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-600 rounded-md divide-y divide-zinc-200 dark:divide-zinc-700">
                            {ledger.map((e) => (
                                <li
                                    key={e.id}
                                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2"
                                >
                                    <div className="flex items-baseline gap-3 min-w-0">
                                        <span className="text-zinc-600 dark:text-zinc-400 tabular-nums shrink-0">
                                            Day {e.settled_day}
                                        </span>
                                        <span
                                            className={
                                                e.net_change_gp >= 0
                                                    ? 'text-green-700 dark:text-green-400 font-medium tabular-nums'
                                                    : 'text-red-700 dark:text-red-400 font-medium tabular-nums'
                                            }
                                        >
                                            {e.net_change_gp >= 0 ? '+' : ''}
                                            {e.net_change_gp} gp
                                        </span>
                                        {Boolean(e.payload_json?.manual_entry) && (
                                            <span className="text-xs text-zinc-500 truncate">manual</span>
                                        )}
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-1.5 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8"
                                                onClick={() => openLedgerEdit(e)}
                                                disabled={saving}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="h-8"
                                                onClick={() => void removeLedgerEntry(e)}
                                                disabled={saving}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={viewerOptionDetail !== null}
                onOpenChange={(open) => {
                    if (!open) setViewerOptionDetail(null);
                }}
            >
                <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 max-h-[85vh] overflow-y-auto">
                    {viewerOptionDetail && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-zinc-900 dark:text-zinc-100 pr-8">
                                    {viewerOptionDetail.def.name}
                                    {viewerOptionDetail.def.is_archived && (
                                        <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                                            archived
                                        </span>
                                    )}
                                </DialogTitle>
                                {viewerOptionDetail.subtitle ? (
                                    <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                                        {viewerOptionDetail.subtitle}
                                    </DialogDescription>
                                ) : (
                                    <DialogDescription className="sr-only">
                                        Description of this tavern catalog option.
                                    </DialogDescription>
                                )}
                            </DialogHeader>
                            <div className="space-y-3 text-sm">
                                <div className="text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {viewerOptionDetail.def.description?.trim()
                                        ? viewerOptionDetail.def.description
                                        : 'No description provided.'}
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                                    {viewerOptionDetail.def.purchase_cost_gp} gp · {viewerOptionDetail.def.setup_days}d
                                    setup
                                </p>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={ledgerEditOpen}
                onOpenChange={(open) => {
                    setLedgerEditOpen(open);
                    if (!open) setLedgerEditTarget(null);
                }}
            >
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Edit ledger line</DialogTitle>
                        <DialogDescription>
                            Changing net gp adjusts treasury by the difference. Day is the campaign day recorded for
                            this line.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Campaign day</Label>
                            <Input
                                value={ledgerEditDay}
                                onChange={(e) => setLedgerEditDay(e.target.value)}
                                className="border-zinc-200 dark:border-zinc-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Net change (gp)</Label>
                            <Input
                                value={ledgerEditNet}
                                onChange={(e) => setLedgerEditNet(e.target.value)}
                                className="border-zinc-200 dark:border-zinc-700"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setLedgerEditOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => void saveLedgerEdit()} disabled={saving}>
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={ledgerManualOpen} onOpenChange={setLedgerManualOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Add ledger line</DialogTitle>
                        <DialogDescription>
                            One-off adjustment (e.g. correction). Net gp is applied to treasury immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Campaign day</Label>
                            <Input
                                value={ledgerManualDay}
                                onChange={(e) => setLedgerManualDay(e.target.value)}
                                className="border-zinc-200 dark:border-zinc-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Net change (gp)</Label>
                            <Input
                                value={ledgerManualNet}
                                onChange={(e) => setLedgerManualNet(e.target.value)}
                                placeholder="e.g. -50 or 120"
                                className="border-zinc-200 dark:border-zinc-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Note (optional)</Label>
                            <Input
                                value={ledgerManualNote}
                                onChange={(e) => setLedgerManualNote(e.target.value)}
                                placeholder="Reason / reference"
                                className="border-zinc-200 dark:border-zinc-700"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setLedgerManualOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => void saveManualLedger()} disabled={saving}>
                                Add
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={defDialogOpen} onOpenChange={setDefDialogOpen}>
                <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>{editingDef ? 'Edit option' : 'New catalog option'}</DialogTitle>
                        <DialogDescription>
                            effect_json: JSON array of effect objects, or a single object — include
                            valuation_bonus, recurring_cost_gp_per_tenday, flags, etc.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Name</Label>
                            <Input value={defName} onChange={(e) => setDefName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <Input value={defDesc} onChange={(e) => setDefDesc(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label>Purchase cost (gp)</Label>
                                <Input value={defCost} onChange={(e) => setDefCost(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label>Setup days</Label>
                                <Input value={defSetup} onChange={(e) => setDefSetup(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Sort order</Label>
                            <Input value={defSort} onChange={(e) => setDefSort(e.target.value)} />
                        </div>
                        {editingDef && (
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={defArchived}
                                    onChange={(e) => setDefArchived(e.target.checked)}
                                />
                                Archived (hide purchase button)
                            </label>
                        )}
                        <div className="space-y-1">
                            <Label>effect_json</Label>
                            <textarea
                                value={defEffect}
                                onChange={(e) => setDefEffect(e.target.value)}
                                className="w-full h-28 p-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setDefDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={submitDefinition} disabled={saving || !defName.trim()}>
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
