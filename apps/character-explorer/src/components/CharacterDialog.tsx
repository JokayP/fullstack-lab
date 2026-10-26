import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CharacterDetails, LocationRecord } from '../types/character';
import { CharacterImage, statusClasses } from './CharacterCard';

export function CharacterDialog({
  character,
  onClose,
}: {
  character: CharacterDetails | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (character) dialog.current?.showModal();
    else dialog.current?.close();
  }, [character]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="character-name"
      className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel p-0 text-white backdrop:bg-black/75"
    >
      {character && (
        <>
          <div className="flex items-center justify-between border-b border-line p-5">
            <span className="font-mono text-xs uppercase tracking-widest text-portal">
              Character dossier / #{String(character.id).padStart(3, '0')}
            </span>
            <button
              onClick={onClose}
              aria-label="Close character details"
              className="rounded-full p-2 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 sm:flex sm:gap-6">
            <CharacterImage
              key={character.id}
              character={character}
              className="mx-auto aspect-square w-44 shrink-0 self-start rounded-xl object-cover"
            />
            <div className="mt-5 min-w-0 sm:mt-0">
              <h2 id="character-name" className="text-2xl font-semibold">
                {character.name}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <span className={`size-2 rounded-full ${statusClasses[character.status]}`} />
                {character.status} · {character.species}
              </p>
              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ['Gender', character.gender],
                  ['Episode appearances', character.episodes.length],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="mb-1 text-xs text-muted">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
            <LocationDetails
              title="Origin"
              location={character.originDetails}
              fallbackName={character.origin.name}
            />
            <LocationDetails
              title="Last known location"
              location={character.locationDetails}
              fallbackName={character.location.name}
            />
          </div>
          <section aria-labelledby="episodes-title" className="border-t border-line p-6">
            <h3 id="episodes-title" className="mb-4 text-lg font-semibold">
              Episode appearances <span className="text-portal">/ {character.episodes.length}</span>
            </h3>
            {character.episodes.length === 0 ? (
              <p className="text-sm text-muted">No recorded episodes.</p>
            ) : (
              <ol className="space-y-3">
                {character.episodes.map((episode) => (
                  <li key={episode.id} className="rounded-lg border border-line bg-void p-4">
                    <p className="font-mono text-[11px] text-portal">{episode.episode}</p>
                    <p className="mt-1 text-sm font-medium">{episode.name}</p>
                    <p className="mt-1 text-xs text-muted">Aired {episode.air_date}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </dialog>
  );
}

function LocationDetails({
  title,
  location,
  fallbackName,
}: {
  title: string;
  location: LocationRecord | null;
  fallbackName: string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-void p-4">
      <h3 className="text-xs text-muted">{title}</h3>
      <p className="mt-2 break-words text-sm font-semibold">{location?.name ?? fallbackName}</p>
      {location ? (
        <dl className="mt-3 space-y-2 text-xs">
          {[
            ['Type', location.type || 'unknown'],
            ['Dimension', location.dimension || 'unknown'],
            ['Known residents', location.residents.length],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="mt-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-xs text-muted">No location record is available.</p>
      )}
    </section>
  );
}
