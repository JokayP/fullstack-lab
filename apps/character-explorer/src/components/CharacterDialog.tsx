import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Character } from '../types/character';
import { CharacterImage, statusClasses } from './CharacterCard';

export function CharacterDialog({
  character,
  onClose,
}: {
  character: Character | null;
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
      className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-panel p-0 text-white backdrop:bg-black/75"
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
                  ['Origin', character.origin.name],
                  ['Last known location', character.location.name],
                  ['Gender', character.gender],
                  ['Episode appearances', character.episode.length],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="mb-1 text-xs text-muted">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
