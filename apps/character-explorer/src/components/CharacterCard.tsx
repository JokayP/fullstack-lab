import { ArrowUpRight, Clapperboard, MapPin } from 'lucide-react';
import type { Character, CharacterDetails, CharacterStatus } from '../types/character';
import { useState } from 'react';

export const statusClasses: Record<CharacterStatus, string> = {
  Alive: 'bg-lime-300',
  Dead: 'bg-orange-400',
  unknown: 'bg-stone-400',
};

export function CharacterImage({
  character,
  className,
}: {
  character: Character;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      className={`${className} grid aspect-square place-items-center bg-panel text-6xl text-muted`}
      role="img"
      aria-label={`${character.name} portrait unavailable`}
    >
      ?
    </div>
  ) : (
    <img
      src={character.image}
      alt={character.name}
      width={300}
      height={300}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function CharacterCard({
  character,
  onSelect,
}: {
  character: CharacterDetails;
  onSelect: (character: CharacterDetails) => void;
}) {
  return (
    <article
      className="group overflow-hidden rounded-xl border border-line bg-panel transition hover:border-lime-300/40"
      data-testid="character-card"
    >
      <div className="relative overflow-hidden">
        <CharacterImage
          character={character}
          className="aspect-[1.2] w-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transform-none"
        />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#131a17]/90 px-2.5 py-1 text-[10px] text-white">
          <span className={`size-1.5 rounded-full ${statusClasses[character.status]}`} />
          {character.status === 'unknown' ? 'Unknown' : character.status}
        </span>
        <span className="absolute bottom-2 right-3 rounded bg-black/60 px-1.5 font-mono text-[10px] text-white">
          #{String(character.id).padStart(3, '0')}
        </span>
      </div>
      <div className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {character.species} <span className="px-1 text-[#536157]">/</span> {character.gender}
        </p>
        <button
          onClick={() => onSelect(character)}
          className="mt-2 flex w-full items-start justify-between gap-2 text-left text-lg font-semibold leading-snug text-white hover:text-portal"
          aria-label={`View ${character.name}`}
        >
          <span>{character.name}</span>
          <ArrowUpRight
            size={17}
            className="mt-1 shrink-0 text-muted transition group-hover:text-portal"
          />
        </button>
        <p className="mt-4 flex items-start gap-1.5 border-t border-line pt-3 text-[11px] text-muted">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="line-clamp-1 text-white">
              {character.locationDetails?.name ?? character.location.name}
            </span>
            <span className="mt-1 line-clamp-1">
              {character.locationDetails?.dimension || 'Unknown dimension'}
            </span>
          </span>
        </p>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted">
          <Clapperboard size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[10px]">First seen in</span>
            <span className="mt-1 line-clamp-1 text-white">
              {character.episodes[0]
                ? `${character.episodes[0].episode} · ${character.episodes[0].name}`
                : 'No recorded episodes'}
            </span>
          </span>
        </p>
      </div>
    </article>
  );
}
