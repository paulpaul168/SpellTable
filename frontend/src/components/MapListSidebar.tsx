import React, { useState } from 'react';
import { MapData } from '../types/map';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Eye, EyeOff, Trash2, Plus, GripVertical, X, FolderPlus } from 'lucide-react';
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
    onClose: () => void;
    onMapRefresh: () => void;
    onMapRename?: (oldName: string, newName: string) => void;
}

export const MapListSidebar: React.FC<MapListSidebarProps> = ({
    scene,
    onMapSelect,
    onMapVisibilityToggle,
    onMapAdd,
    onMapsReorder,
    onMapDelete,
    onClose,
    onMapRefresh,
    onMapRename
}) => {
    const [isMapManagementOpen, setIsMapManagementOpen] = useState(false);

    const handleOpenMapManagement = () => {
        console.log("Opening map management dialog and refreshing maps");
        onMapRefresh();
        setIsMapManagementOpen(true);
    };

    const handleMapRename = (oldName: string, newName: string) => {
        console.log(`MapListSidebar: Processing map rename from "${oldName}" to "${newName}"`);
        if (onMapRename) {
            onMapRename(oldName, newName);
        } else {
            console.warn("MapListSidebar: onMapRename handler is not defined");
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
        <div className="fixed top-0 right-0 w-[320px] min-h-[200px] max-h-[80%] bg-zinc-900/50 backdrop-blur-sm border-t border-zinc-800/50 flex flex-col rounded-tl-lg z-[1000]">
            <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-300">Maps</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={onClose}
                            title="Close sidebar"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleOpenMapManagement}
                >
                    <FolderPlus className="h-4 w-4" />
                    Manage Maps
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

            <MapManagement
                isOpen={isMapManagementOpen}
                onClose={() => setIsMapManagementOpen(false)}
                onMapSelect={(mapName) => {
                    onMapSelect(mapName);
                    setIsMapManagementOpen(false);
                }}
                onRefreshMaps={onMapRefresh}
                onMapRename={handleMapRename}
                maps={scene.maps}
            />
        </div>
    );
}; 