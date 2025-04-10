import React from 'react';
import { MapData } from '../types/map';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Eye, EyeOff, Trash2, Plus, GripVertical } from 'lucide-react';
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
                "group flex items-center gap-2 p-2 rounded-md cursor-pointer",
                isActive ? "bg-zinc-800" : "hover:bg-zinc-800/50"
            )}
        >
            <div
                className="p-1 rounded hover:bg-zinc-800 cursor-grab"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3 text-zinc-500" />
            </div>
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onVisibilityToggle();
                        }}
                        className="p-1 rounded hover:bg-zinc-800 shrink-0"
                    >
                        {map.data.isHidden ? (
                            <EyeOff className="h-4 w-4 text-zinc-400" />
                        ) : (
                            <Eye className="h-4 w-4 text-zinc-400" />
                        )}
                    </button>
                    <span className="text-xs text-zinc-300 truncate max-w-[120px]" title={map.name}>
                        {map.name}
                    </span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-1 rounded hover:bg-zinc-800 shrink-0"
                >
                    <Trash2 className="h-4 w-4 text-zinc-400" />
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
    onMapVisibilityToggle: (mapName: string) => void;
    onMapAdd: () => void;
    onMapsReorder: (newMaps: MapData[]) => void;
    onMapDelete: (mapName: string) => void;
}

export const MapListSidebar: React.FC<MapListSidebarProps> = ({
    scene,
    onMapSelect,
    onMapVisibilityToggle,
    onMapAdd,
    onMapsReorder,
    onMapDelete,
}) => {
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
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={onMapAdd}
                >
                    <Plus className="h-4 w-4" />
                    Add Map
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={scene.maps.map((map: MapData) => map.name)}
                        strategy={verticalListSortingStrategy}
                    >
                        {scene.maps.map((map) => (
                            <MapListItem
                                key={map.name}
                                map={map}
                                isActive={map.name === scene.activeMapId}
                                onSelect={() => onMapSelect(map.name)}
                                onVisibilityToggle={() => onMapVisibilityToggle(map.name)}
                                onDelete={() => onMapDelete(map.name)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}; 