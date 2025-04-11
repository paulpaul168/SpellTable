import { Scene, MapData } from '../types/map';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Eye, Plus, Trash2, GripVertical } from 'lucide-react';
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
    onMapSelect: (mapName: string | null) => void;
    onMapVisibilityToggle: (mapName: string) => void;
    onMapAdd: () => void;
    onMapsReorder: (newMaps: MapData[]) => void;
    onMapDelete: (mapName: string) => void;
}

interface SortableItemProps {
    id: string;
    map: MapData;
    isActive: boolean;
    onSelect: () => void;
    onVisibilityToggle: () => void;
    onDelete: () => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, map, isActive, onSelect, onVisibilityToggle, onDelete }) => {
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
                "group flex items-center gap-2 p-2 rounded-lg transition-colors",
                isActive ? "bg-zinc-800" : "hover:bg-zinc-800/50"
            )}
        >
            <div
                className="p-1 rounded hover:bg-zinc-700 cursor-grab"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3 text-zinc-500" />
            </div>
            <button
                className="flex-1 flex items-center gap-2"
                onClick={onSelect}
            >
                <Eye
                    className={cn(
                        "h-4 w-4 transition-colors",
                        map.data.isHidden ? "text-zinc-600" : "text-zinc-400"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onVisibilityToggle();
                    }}
                />
                <span className="text-sm text-zinc-300 truncate">
                    {map.name}
                </span>
            </button>
            <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-zinc-700"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
            >
                <Trash2 className="h-4 w-4 text-zinc-400" />
            </button>
        </div>
    );
};

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
                    className="w-full gap-2"
                    onClick={onMapAdd}
                >
                    <Plus className="h-4 w-4" />
                    <span>Add Map</span>
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div
                    className={cn(
                        "group flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer",
                        scene.activeMapId === null
                            ? "bg-zinc-800"
                            : "hover:bg-zinc-800/50"
                    )}
                    onClick={() => onMapSelect(null)}
                >
                    <Eye className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm text-zinc-300">No Map Selected</span>
                </div>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={scene.maps.map((map: MapData) => map.name)}
                        strategy={verticalListSortingStrategy}
                    >
                        {scene.maps.map((map: MapData) => (
                            <SortableItem
                                key={map.name}
                                id={map.name}
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