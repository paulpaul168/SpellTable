export interface AudioTrack {
    id: string;
    name: string;
    type: 'music' | 'effect';
    url: string;
    duration?: number;  // Will be set when audio loads
    loop?: boolean;
    randomize?: boolean; // Whether to start playback from a random position
}

export const audioTracks: AudioTrack[] = [
    {
        id: 'epic-battle',
        name: 'Epic Battle',
        type: 'music',
        url: '/audio/epic-battle.mp3',
        loop: true,
        randomize: true
    },
    {
        id: 'tavern-ambience',
        name: 'Tavern Ambience',
        type: 'music',
        url: '/audio/tavern-ambience.mp3',
        loop: true,
        randomize: true
    },
    {
        id: 'forest-ambience',
        name: 'Forest Ambience',
        type: 'music',
        url: '/audio/forest-ambience.mp3',
        loop: true,
        randomize: true
    },
    {
        id: 'dungeon-ambience',
        name: 'Dungeon Ambience',
        type: 'music',
        url: '/audio/dungeon-ambience.mp3',
        loop: true,
        randomize: true
    }
];

export const soundEffects: AudioTrack[] = [
    {
        id: 'sword-clash',
        name: 'Sword Clash',
        type: 'effect',
        url: '/audio/sword-clash.mp3',
        loop: false,
        randomize: false // Sound effects typically shouldn't randomize
    },
    {
        id: 'magic-cast',
        name: 'Magic Cast',
        type: 'effect',
        url: '/audio/magic-cast.mp3',
        loop: false,
        randomize: false
    },
    {
        id: 'door-creak',
        name: 'Door Creak',
        type: 'effect',
        url: '/audio/door-creak.mp3',
        loop: false,
        randomize: false
    },
    {
        id: 'treasure-chest',
        name: 'Treasure Chest',
        type: 'effect',
        url: '/audio/treasure-chest.mp3',
        loop: false,
        randomize: false
    }
]; 