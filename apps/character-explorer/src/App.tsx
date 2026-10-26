import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  Orbit,
  Radar,
  Search,
  X,
} from 'lucide-react';
import { CharacterCard } from './components/CharacterCard';
import { CharacterDialog } from './components/CharacterDialog';
import { SearchLoading } from './components/SearchLoading';
import { initialFilters, useCharacterSearch } from './hooks/use-character-search';
import type { CharacterDetails, StatusFilter } from './types/character';

const statusOptions: Array<{ value: StatusFilter; label: string; color: string }> = [
  { value: '', label: 'All life forms', color: '' },
  { value: 'alive', label: 'Alive', color: 'bg-lime-300' },
  { value: 'dead', label: 'Dead', color: 'bg-orange-400' },
  { value: 'unknown', label: 'Unknown', color: 'bg-stone-400' },
];

export default function App() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [selected, setSelected] = useState<CharacterDetails | null>(null);
  const { state, filters, search, retry } = useCharacterSearch();
  const data = state.phase === 'success' ? state.data : null;
  const loading = state.phase === 'loading';

  function changeName(value: string) {
    setName(value);
    search({ name: value, status, page: 1 }, { debounce: true });
  }

  function reset() {
    setName('');
    setStatus('');
    search(initialFilters);
  }
  function selectStatus(value: StatusFilter) {
    setStatus(value);
    search({ name, status: value, page: 1 });
  }
  function changePage(page: number) {
    search({ ...filters, page });
    document.getElementById('directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <a href="#directory" className="skip-link">
        Skip to character directory
      </a>
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-6 sm:px-10">
        <a href="#" className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-.04em]">
          <Orbit className="text-portal" size={27} strokeWidth={1.6} />
          PORTAL<span className="text-portal">.</span>
          <span className="ml-4 hidden border-l border-line pl-6 font-mono text-[9px] font-normal uppercase tracking-widest text-muted sm:block">
            Rick and Morty
            <br />
            field guide
          </span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-7">
          <a href="#directory" className="text-xs text-portal">
            Character directory
          </a>
          <a
            href="https://rickandmortyapi.com/documentation"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 text-xs text-muted hover:text-white sm:flex"
          >
            About the API <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>
      <main>
        <section
          className="relative mx-auto grid max-w-7xl items-center gap-8 overflow-hidden px-6 py-12 sm:px-10 md:grid-cols-[1.25fr_1fr] lg:py-16"
          aria-labelledby="hero-title"
        >
          <div className="relative z-10">
            <p className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-portal">
              <span className="size-1.5 rounded-full bg-portal" /> Your next dimension starts here
            </p>
            <h1
              id="hero-title"
              className="text-[clamp(2.8rem,5.7vw,5.1rem)] font-semibold leading-[1.03] tracking-[-.055em]"
            >
              Strange worlds.
              <br />
              <span className="text-portal">Familiar faces.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-muted">
              Meet the humans, aliens, and everything in between.
              <br className="hidden sm:block" /> Your field guide to the wonderfully weird
              multiverse of Rick and Morty.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-5 font-mono text-[10px] uppercase tracking-wide text-muted">
              <span className="flex items-center gap-2">
                <Orbit size={14} className="text-portal" /> Infinite possibilities
              </span>
              <span className="h-3 w-px bg-line" />
              <span>One character at a time</span>
            </div>
          </div>
          <div
            className="portal-illustration relative mx-auto flex h-64 w-full max-w-sm items-center justify-center sm:h-72 lg:h-80"
            aria-hidden="true"
          >
            <div className="absolute inset-0 rounded-full bg-portal/5 blur-3xl" />
            <div className="portal-orbit absolute h-56 w-80 -rotate-[28deg] rounded-[50%] border border-portal/20" />
            <div className="portal-orbit absolute h-64 w-72 rotate-[38deg] rounded-[50%] border border-portal/15" />
            <div className="portal-core">
              <div className="portal-inner">
                <Orbit size={69} strokeWidth={0.8} className="text-[#def4a0]" />
              </div>
            </div>
            <span className="absolute left-1 top-9 font-mono text-[9px] tracking-widest text-muted">
              DIMENSION C-137
            </span>
            <span className="absolute bottom-4 right-0 flex items-center gap-2 rounded border border-portal/20 bg-void px-3 py-2 font-mono text-[9px] text-portal">
              <span className="size-1.5 rounded-full bg-portal" /> UNIVERSE UNKNOWN
            </span>
            <span className="absolute right-9 top-9 text-xl font-light text-portal">+</span>
            <span className="absolute bottom-12 left-8 text-sm text-muted">+</span>
          </div>
        </section>
        <section
          id="directory"
          className="mx-auto max-w-7xl scroll-mt-4 px-6 pb-16 sm:px-10"
          aria-labelledby="directory-title"
        >
          <div
            role="search"
            className="rounded-xl border border-line bg-panel p-4 sm:p-5"
            aria-label="Character search"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={19}
                  className="pointer-events-none absolute left-4 top-4 text-muted"
                />
                <input
                  aria-label="Search characters by name"
                  type="search"
                  value={name}
                  onChange={(event) => changeName(event.target.value)}
                  placeholder="Search the multiverse. Try Rick, Morty, or Summer..."
                  className="h-12 w-full rounded-lg border border-line bg-void pl-12 pr-10 text-sm placeholder:text-[#7e8a80]"
                />
                {name && (
                  <button
                    type="button"
                    aria-label="Clear character name"
                    className="absolute right-3 top-3 rounded p-1 text-muted hover:text-white"
                    onClick={() => changeName('')}
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by life status">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={status === option.value}
                    onClick={() => selectStatus(option.value)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] transition ${status === option.value ? 'border-portal/30 bg-portal/10 text-portal' : 'border-transparent text-muted hover:bg-white/5 hover:text-white'}`}
                  >
                    {option.color && <span className={`size-1.5 rounded-full ${option.color}`} />}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 pb-6 pt-9">
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[.2em] text-muted">
                The inhabitants of everywhere
              </p>
              <h2 id="directory-title" className="text-2xl font-semibold tracking-tight">
                Character directory <span className="text-portal">/</span>
              </h2>
            </div>
            <p role="status" className="font-mono text-[10px] text-muted">
              {loading
                ? 'SCANNING THE MULTIVERSE...'
                : data
                  ? `${data.info.count} CHARACTERS FOUND${filters.name ? ` FOR “${filters.name}”` : ''}`
                  : 'CONNECTION INTERRUPTED'}
            </p>
          </div>
          {loading ? (
            <SearchLoading />
          ) : state.phase === 'error' ? (
            <div
              role="alert"
              className="rounded-xl border border-orange-300/25 bg-orange-300/5 px-6 py-12 text-center"
            >
              <Radar className="mx-auto mb-4 text-orange-300" size={32} />
              <h3 className="text-xl font-semibold">A little interdimensional interference.</h3>
              <p className="mt-3 text-sm text-muted">{state.message}</p>
              <button
                onClick={retry}
                className="mt-6 rounded-lg bg-portal px-6 py-3 text-sm font-semibold text-void"
              >
                Try again
              </button>
            </div>
          ) : data?.results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <CircleHelp size={36} className="mx-auto mb-4 text-portal" />
              <h3 className="text-2xl font-semibold">No life forms detected.</h3>
              <p className="mt-3 text-sm text-muted">
                Try another name or life status. This universe has plenty of surprises.
              </p>
              <button
                onClick={reset}
                className="mt-6 rounded-lg bg-portal px-6 py-3 text-sm font-semibold text-void"
              >
                Reset exploration
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 min-[440px]:grid-cols-2 lg:grid-cols-4">
              {data?.results.map((character) => (
                <CharacterCard key={character.id} character={character} onSelect={setSelected} />
              ))}
            </div>
          )}
          {data && data.info.pages > 0 && (
            <nav
              aria-label="Character pages"
              className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
            >
              <span className="font-mono text-[11px] text-muted">
                Page <span className="text-white">{filters.page}</span> of {data.info.pages}{' '}
                <span className="mx-2 text-[#516056]">/</span> {data.results.length} on this page
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => changePage(filters.page - 1)}
                  disabled={filters.page <= 1}
                  className="page-button"
                >
                  <ArrowLeft size={15} /> Previous
                </button>
                <button
                  onClick={() => changePage(filters.page + 1)}
                  disabled={filters.page >= data.info.pages}
                  className="page-button"
                >
                  Next dimension <ArrowRight size={15} />
                </button>
              </div>
            </nav>
          )}
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-7 text-xs text-muted sm:px-10">
          <span className="flex items-center gap-2 font-semibold tracking-wide text-white">
            <Orbit size={17} className="text-portal" /> PORTAL.
          </span>
          <span>An unofficial field guide. Curiosity encouraged.</span>
          <a
            href="https://rickandmortyapi.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-portal"
          >
            Powered by The Rick and Morty API <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
      <CharacterDialog character={selected} onClose={() => setSelected(null)} />
    </>
  );
}
