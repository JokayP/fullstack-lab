import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { episodes, jsonResponse, locations, rick } from './test/fixtures';
import App from './App';

it('searches while typing without Enter, keeps the delay and does not advertise seconds', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ info: { count: 0, pages: 0 }, results: [] }),
    }),
  );
  render(<App />);
  expect(screen.queryByText(/seconds/i)).not.toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(3999));
  expect(screen.getByLabelText('Searching characters')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole('heading', { name: 'No life forms detected.' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Rick' } });
  expect(screen.queryByRole('button', { name: 'Open portal' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Searching characters')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(3999));
  expect(screen.getByLabelText('Searching characters')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.queryByLabelText('Searching characters')).not.toBeInTheDocument();
  expect(screen.queryByText(/seconds/i)).not.toBeInTheDocument();
});

it('renders joined location and episode data, preserves pagination filters and clears the query', async () => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  const fetchMock = vi.fn(async (url: URL) => {
    if (url.pathname === '/api/character') {
      return jsonResponse({ info: { count: 21, pages: 2 }, results: [rick] });
    }
    return jsonResponse(url.pathname.includes('/location/') ? locations : episodes);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' Rick ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Alive' }));
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(screen.getByText('Replacement Dimension')).toBeInTheDocument();
  expect(screen.getByText('S01E01 · Pilot')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Rick Sanchez' }));
  const dossier = within(screen.getByRole('dialog'));
  expect(dossier.getByText('Dimension C-137')).toBeInTheDocument();
  expect(dossier.getByText('Lawnmower Dog')).toBeInTheDocument();
  expect(dossier.getByText('Aired December 9, 2013')).toBeInTheDocument();
  fireEvent.click(dossier.getByRole('button', { name: 'Close character details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next dimension' }));
  await act(() => vi.advanceTimersByTimeAsync(4000));
  let lastQuery = fetchMock.mock.calls
    .filter(([url]) => url.pathname === '/api/character')
    .at(-1)![0];
  expect(lastQuery.searchParams.get('page')).toBe('2');
  expect(lastQuery.searchParams.get('name')).toBe('Rick');
  expect(lastQuery.searchParams.get('status')).toBe('alive');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Morty' } });
  await act(() => vi.advanceTimersByTimeAsync(4000));
  lastQuery = fetchMock.mock.calls.filter(([url]) => url.pathname === '/api/character').at(-1)![0];
  expect(lastQuery.searchParams.get('page')).toBe('1');
  expect(lastQuery.searchParams.get('name')).toBe('Morty');
  fireEvent.click(screen.getByRole('button', { name: 'Clear character name' }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await act(() => vi.advanceTimersByTimeAsync(4000));
  lastQuery = fetchMock.mock.calls.filter(([url]) => url.pathname === '/api/character').at(-1)![0];
  expect(lastQuery.searchParams.has('name')).toBe(false);
  expect(lastQuery.searchParams.get('page')).toBe('1');
});
