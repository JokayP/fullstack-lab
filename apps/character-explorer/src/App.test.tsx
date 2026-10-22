import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from './App';

it('keeps the required delay without advertising seconds in the interface', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Open portal' }));
  expect(screen.getByLabelText('Searching characters')).toBeInTheDocument();
  expect(screen.queryByText(/seconds/i)).not.toBeInTheDocument();
});
