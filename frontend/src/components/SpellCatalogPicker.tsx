'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { spellCatalogService } from '@/services/spell_catalog_service';
import type { SpellCatalogEntry } from '@/types/monster';

type Props = {
    available: boolean;
    onPick: (entry: SpellCatalogEntry) => void;
};

export function SpellCatalogPicker({ available, onPick }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SpellCatalogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!available) return;
        let cancelled = false;
        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                const list = await spellCatalogService.listSpells(query);
                if (!cancelled) setResults(list.slice(0, 40));
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 200);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [query, available]);

    if (!available) return null;

    return (
        <div className="space-y-2 rounded border border-dashed border-zinc-300 p-2 dark:border-zinc-600">
            <p className="text-xs text-muted-foreground">
                Aurora catalog (adds name/level only — no description pasted)
            </p>
            <Input
                placeholder="Search spells…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 text-sm"
            />
            {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
            {!loading && results.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {results.map((sp) => (
                        <li key={sp.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                                {sp.name}{' '}
                                <span className="text-xs text-muted-foreground">
                                    ({sp.level === 0 ? 'cantrip' : `L${sp.level}`})
                                </span>
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 shrink-0 px-2 text-xs"
                                onClick={() => onPick(sp)}
                            >
                                Add
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
