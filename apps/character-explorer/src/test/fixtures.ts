import type { Character, Episode, LocationRecord } from '../types/character';

export const rick: Character = {
  id: 1,
  name: 'Rick Sanchez',
  status: 'Alive',
  species: 'Human',
  gender: 'Male',
  image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
  origin: { name: 'Earth (C-137)', url: 'https://rickandmortyapi.com/api/location/1' },
  location: {
    name: 'Earth (Replacement Dimension)',
    url: 'https://rickandmortyapi.com/api/location/20',
  },
  episode: [
    'https://rickandmortyapi.com/api/episode/1',
    'https://rickandmortyapi.com/api/episode/2',
  ],
};

export const morty: Character = {
  ...rick,
  id: 2,
  name: 'Morty Smith',
  origin: { name: 'unknown', url: '' },
  episode: ['https://rickandmortyapi.com/api/episode/2'],
};

export const locations: LocationRecord[] = [
  { id: 1, name: 'Earth (C-137)', type: 'Planet', dimension: 'Dimension C-137', residents: [] },
  {
    id: 20,
    name: 'Earth (Replacement Dimension)',
    type: 'Planet',
    dimension: 'Replacement Dimension',
    residents: ['https://rickandmortyapi.com/api/character/1'],
  },
];

export const episodes: Episode[] = [
  { id: 1, name: 'Pilot', episode: 'S01E01', air_date: 'December 2, 2013' },
  { id: 2, name: 'Lawnmower Dog', episode: 'S01E02', air_date: 'December 9, 2013' },
];

export function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}
