import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { products, jsonResponse } from './test/fixtures';
import type { Product } from './types/product';

describe('Paper and Form storefront', () => {
  it('filters on input without Enter or another HTTP request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(products));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    expect(await screen.findAllByTestId('product-card')).toHaveLength(3);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), {
      target: { value: '  NOTE ' },
    });
    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Notebook' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(3);
  });

  it('creates, reloads, edits and deletes products through the backend contract', async () => {
    let stored: Product[] = products.map((product) => ({ ...product }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
        if (options.method === 'POST') {
          const saved = { ...JSON.parse(String(options.body)), id: 10 } as Product;
          stored = [...stored, saved];
          return jsonResponse(saved, 201);
        }
        if (options.method === 'PUT') {
          const saved = { ...JSON.parse(String(options.body)), id: 10 } as Product;
          stored = stored.map((product) => (product.id === 10 ? saved : product));
          return jsonResponse(saved);
        }
        if (options.method === 'DELETE') {
          expect(url).toContain('/10');
          stored = stored.filter((product) => product.id !== 10);
          return jsonResponse(null, 204);
        }
        return jsonResponse(stored.map((product) => ({ ...product })));
      }),
    );
    const first = render(<App />);
    await screen.findAllByTestId('product-card');
    fireEvent.click(screen.getByRole('button', { name: 'New product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Ruler' } });
    fireEvent.change(screen.getByLabelText('Price (USD)'), { target: { value: '1.25' } });
    fireEvent.change(screen.getByLabelText('Stock'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await screen.findByRole('heading', { name: 'Ruler' });
    first.unmount();
    render(<App />);
    await screen.findByRole('heading', { name: 'Ruler' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ruler' }));
    fireEvent.change(screen.getByLabelText('Price (USD)'), { target: { value: '2.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await screen.findByText('$2.75');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ruler' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Ruler' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ruler' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete product' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Ruler' })).not.toBeInTheDocument(),
    );
    expect(stored).toHaveLength(3);
  });

  it('keeps a failed save visible with entered values and does not invent a product', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(products));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await screen.findAllByTestId('product-card');
    fetchMock.mockResolvedValue(jsonResponse({ message: 'The product could not be saved' }, 500));
    fireEvent.click(screen.getByRole('button', { name: 'New product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Ruler' } });
    fireEvent.change(screen.getByLabelText('Price (USD)'), { target: { value: '1.25' } });
    fireEvent.change(screen.getByLabelText('Stock'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.getByLabelText('Product name')).toHaveValue('Ruler');
    expect(screen.queryByRole('heading', { name: 'Ruler' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save product' })).toBeEnabled();
  });

  it('shows a recoverable connection error and loads the catalog on retry', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Start the backend');
    expect(screen.queryByTestId('product-card')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New product' })).toBeDisabled();
    fetchMock.mockResolvedValue(jsonResponse(products));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('product-card')).toHaveLength(3);
  });
});
