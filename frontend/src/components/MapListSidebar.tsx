import React, { useState } from 'react';
import { MapData, Scene } from '../types/map';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    Folder,
    FolderOpen,
    GripVertical,
    Image as ImageIcon,
    Plus,
} from 'lucide-react';
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

interface MapListSidebarProps {
    scene: Scene;
    onMapSelect: (mapName: string) => void;
    onMapVisibilityToggle: (mapName: string) => void;
    onMapAdd: () => void;
    onMapsReorder: (maps: MapData[]) => void;
}

interface SortableItemProps {
    id: string;
    map: MapData;
    isActive: boolean;
    onSelect: () => void;
    onVisibilityToggle: () => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, map, isActive, onSelect, onVisibilityToggle }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group",
                isActive && "bg-zinc-800"
            )}
            onClick={onSelect}
        >
            <div
                className="p-1 rounded hover:bg-zinc-700 cursor-grab"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3 text-zinc-500" />
            </div>
            <div className="flex-1 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-zinc-400" />
                <span className="text-xs text-zinc-300">{map.name}</span>
            </div>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                    e.stopPropagation();
                    onVisibilityToggle();
                }}
            >
                {map.data.isHidden ? (
                    <EyeOff className="h-4 w-4 text-zinc-400" />
                ) : (
                    <Eye className="h-4 w-4 text-zinc-400" />
                )}
            </Button>
        </div>
    );
};

export const MapListSidebar: React.FC<MapListSidebarProps> = ({
    scene,
    onMapSelect,
    onMapVisibilityToggle,
    onMapAdd,
    onMapsReorder,
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
            const oldIndex = scene.maps.findIndex(m => m.name === active.id);
            const newIndex = scene.maps.findIndex(m => m.name === over.id);
            const newMaps = arrayMove(scene.maps, oldIndex, newIndex);
            onMapsReorder(newMaps);
        }
    };

    return (
        <div className="w-64 h-full bg-zinc-900/95 border-l border-zinc-800 flex flex-col">
            <div className="p-2 border-b border-zinc-800">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={onMapAdd}
                >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs">Add Map</span>
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={scene.maps.map(m => m.name)}
                        strategy={verticalListSortingStrategy}
                    >
                        {scene.maps.map(map => (
                            <SortableItem
                                key={map.name}
                                id={map.name}
                                map={map}
                                isActive={map.name === scene.activeMapId}
                                onSelect={() => onMapSelect(map.name)}
                                onVisibilityToggle={() => onMapVisibilityToggle(map.name)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}; 