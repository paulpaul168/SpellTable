import React, { useState } from 'react';
import { MapData } from '../types/map';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Eye, EyeOff, Trash2, GripVertical, FolderPlus } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapManagement } from './MapManagement';
import { GlassPanel } from './gameboard/GlassPanel';

interface MapListItemProps {
    map: MapData;
    isActive: boolean;
    onSelect: () => void;
    onVisibilityToggle: () => void;
    onDelete: () => void;
}

const MapListItem: React.FC<MapListItemProps> = ({
    map,
    isActive,
    onSelect,
    onVisibilityToggle,
    onDelete,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: map.name });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={cn(
                'group flex min-h-9 cursor-pointer items-center gap-2 rounded-md p-2 transition-colors',
                isActive
                    ? 'bg-accent/20 ring-1 ring-border'
                    : 'hover:bg-accent/10'
            )}
        >
            <div
                className="cursor-grab rounded p-1 hover:bg-accent/20"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex w-full items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onVisibilityToggle();
                        }}
                        className="shrink-0 rounded p-1 hover:bg-accent/20"
                    >
                        {map.data.isHidden ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>
                    <span
                        className="max-w-[120px] truncate text-sm text-foreground"
                        title={map.name}
                    >
                        {map.name}
                    </span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="shrink-0 rounded p-1 hover:bg-accent/20"
                >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
};

interface MapListSidebarProps {
    scene: {
        maps: MapData[];
        activeMapId: string | null;
    };
    onMapSelect: (mapName: string | null) => void;
    onMapsAdd: (mapNames: string[]) => void;
    onMapVisibilityToggle: (mapName: string) => void;
    onMapAdd: () => void;
    onMapsReorder: (newMaps: MapData[]) => void;
    onMapDelete: (mapName: string) => void;
    onClose: () => void;
    onMapRefresh: () => void;
    onMapRename?: (oldName: string, newName: string) => void;
    hideInvisibleMaps: boolean;
    onToggleHideInvisibleMaps: () => void;
}

export const MapListSidebar: React.FC<MapListSidebarProps> = ({
    scene,
    onMapSelect,
    onMapsAdd,
    onMapVisibilityToggle,
    onMapDelete,
    onClose,
    onMapRefresh,
    onMapRename,
    hideInvisibleMaps,
    onToggleHideInvisibleMaps,
    onMapsReorder,
}) => {
    const [isMapManagementOpen, setIsMapManagementOpen] = useState(false);

    const handleOpenMapManagement = () => {
        onMapRefresh();
        setIsMapManagementOpen(true);
    };

    const handleMapRename = (oldName: string, newName: string) => {
        if (onMapRename) {
            onMapRename(oldName, newName);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = scene.maps.findIndex((map: MapData) => map.name === active.id);
            const newIndex = scene.maps.findIndex((map: MapData) => map.name === over.id);
            const newMaps = arrayMove([...scene.maps], oldIndex, newIndex);
            onMapsReorder(newMaps);
        }
    };

    return (
        <>
            <GlassPanel
                title="Maps"
                edge="right"
                onClose={onClose}
                headerActions={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onToggleHideInvisibleMaps}
                        title={hideInvisibleMaps ? 'Show hidden maps' : 'Hide hidden maps'}
                    >
                        {hideInvisibleMaps ? (
                            <Eye className="h-4 w-4" />
                        ) : (
                            <EyeOff className="h-4 w-4" />
                        )}
                    </Button>
                }
                footer={
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleOpenMapManagement}
                    >
                        <FolderPlus className="h-4 w-4" />
                        Manage Maps
                    </Button>
                }
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={scene.maps.map((map: MapData) => map.name)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1">
                            {scene.maps.map((map) => (
                                <MapListItem
                                    key={map.name}
                                    map={map}
                                    isActive={map.name === scene.activeMapId}
                                    onSelect={() => onMapSelect(map.name)}
                                    onVisibilityToggle={() =>
                                        onMapVisibilityToggle(map.name)
                                    }
                                    onDelete={() => onMapDelete(map.name)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </GlassPanel>

            <MapManagement
                isOpen={isMapManagementOpen}
                onClose={() => setIsMapManagementOpen(false)}
                onMapsAdd={(mapNames) => {
                    onMapsAdd(mapNames);
                    setIsMapManagementOpen(false);
                }}
                onRefreshMaps={onMapRefresh}
                onMapRename={handleMapRename}
                maps={scene.maps}
            />
        </>
    );
};
