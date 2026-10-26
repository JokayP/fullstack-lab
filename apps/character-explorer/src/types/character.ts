export type CharacterStatus = 'Alive' | 'Dead' | 'unknown';
export type StatusFilter = '' | 'alive' | 'dead' | 'unknown';

export interface Character {
  id: number;
  name: string;
  status: CharacterStatus;
  species: string;
  gender: string;
  image: string;
  origin: { name: string; url: string };
  location: { name: string; url: string };
  episode: string[];
}

export interface LocationRecord {
  id: number;
  name: string;
  type: string;
  dimension: string;
  residents: string[];
}

export interface Episode {
  id: number;
  name: string;
  episode: string;
  air_date: string;
}

export interface CharacterDetails extends Character {
  originDetails: LocationRecord | null;
  locationDetails: LocationRecord | null;
  episodes: Episode[];
}

export interface CharacterPage {
  info: { count: number; pages: number };
  results: Character[];
}

export interface CharacterDirectoryPage {
  info: CharacterPage['info'];
  results: CharacterDetails[];
}

export interface SearchFilters {
  name: string;
  status: StatusFilter;
  page: number;
}
export type SearchState =
  | { phase: 'loading' }
  | { phase: 'success'; data: CharacterDirectoryPage }
  | { phase: 'error'; message: string };
