export type CharacterStatus = 'Alive' | 'Dead' | 'unknown';
export type StatusFilter = '' | 'alive' | 'dead' | 'unknown';

export interface Character {
  id: number;
  name: string;
  status: CharacterStatus;
  species: string;
  gender: string;
  image: string;
  origin: { name: string };
  location: { name: string };
  episode: string[];
}

export interface CharacterPage {
  info: { count: number; pages: number };
  results: Character[];
}

export interface SearchFilters {
  name: string;
  status: StatusFilter;
  page: number;
}
export type SearchState =
  | { phase: 'loading' }
  | { phase: 'success'; data: CharacterPage }
  | { phase: 'error'; message: string };
