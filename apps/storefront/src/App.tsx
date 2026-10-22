import { useMemo, useState } from 'react';
import { ArrowDownRight, Leaf, Package, Plus, RefreshCw, Search, X } from 'lucide-react';
import { ProductCard } from './components/ProductCard';
import { ProductForm } from './components/ProductForm';
import { DeleteProductDialog } from './components/DeleteProductDialog';
import { useProducts } from './hooks/use-products';
import type { Product, ProductInput } from './types/product';
import { filterProducts } from './utils/products';

const emptyProducts: Product[] = [];

export default function App() {
  const { state, reload, save, remove } = useProducts();
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ product: Product | null } | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [message, setMessage] = useState('');
  const products = state.phase === 'success' ? state.products : emptyProducts;
  const visibleProducts = useMemo(() => filterProducts(products, query), [products, query]);

  async function saveAndAnnounce(input: ProductInput, id?: number) {
    const product = await save(input, id);
    setMessage(`${product.name} saved.`);
  }

  async function deleteAndAnnounce(id: number) {
    await remove(id);
    setMessage('Product deleted.');
  }

  return (
    <>
      <a href="#products" className="skip-link">
        Skip to products
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10">
          <a
            href="#"
            className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"
            aria-label="Paper and Form home"
          >
            <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
              <Leaf size={18} />
            </span>
            paper <span className="font-normal text-stone-400">&</span> form
            <span className="text-clay">.</span>
          </a>
          <a
            href="#products"
            className="flex items-center gap-2 text-xs font-medium text-stone-600"
          >
            The collection <ArrowDownRight size={15} />
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 sm:px-10">
        <section className="grid gap-8 py-12 sm:py-16 md:grid-cols-[1.3fr_1fr] md:items-end">
          <div>
            <p className="eyebrow">A little less. A little better.</p>
            <h1 className="mt-4 max-w-xl text-[clamp(2.5rem,5.5vw,4.5rem)] font-semibold leading-[1.04] tracking-[-.055em]">
              Good things for
              <br />
              <span className="font-serif italic font-normal text-forest">everyday.</span>
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-7 text-stone-500 md:justify-self-end">
            Simple essentials for your desk, your ideas, and everything in between. Find what you
            need in our small collection.
          </p>
        </section>
        <section
          id="products"
          aria-labelledby="products-title"
          className="scroll-mt-5 border-t border-line pb-14 pt-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <h2 id="products-title" className="text-2xl font-semibold tracking-tight">
                The collection
              </h2>
              <span className="text-xs text-stone-500">
                {state.phase === 'success' ? `${products.length} products` : ''}
              </span>
            </div>
            <button
              disabled={state.phase !== 'success'}
              onClick={() => setEditor({ product: null })}
              className="primary-button"
            >
              <Plus size={16} />
              New product
            </button>
          </div>
          <div className="mt-6 flex gap-3">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-3.5 text-stone-400"
                size={18}
              />
              <input
                type="search"
                aria-label="Search products"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products by name…"
                className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-11 text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-3 p-1 text-stone-500"
                >
                  <X size={17} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setMessage('');
                reload();
              }}
              disabled={state.phase === 'loading'}
              className="secondary-button"
              aria-label="Refresh products"
            >
              <RefreshCw size={17} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-4 text-xs text-stone-500">
            <p role="status">
              {state.phase === 'loading'
                ? 'Loading products…'
                : state.phase === 'error'
                  ? 'The collection is unavailable.'
                  : `${visibleProducts.length} ${visibleProducts.length === 1 ? 'product' : 'products'}${query.trim() ? ` matching “${query.trim()}”` : ' to explore'}`}
            </p>
            <p role="status" className="text-forest">
              {message}
            </p>
          </div>
          {state.phase === 'loading' ? (
            <div
              aria-label="Loading products"
              aria-busy="true"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[1, 2, 3].map((key) => (
                <div
                  key={key}
                  className="h-96 animate-pulse rounded-2xl bg-sand motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : state.phase === 'error' ? (
            <div role="alert" className="rounded-2xl border border-line bg-white p-8 text-center">
              <Package className="mx-auto text-clay" />
              <h3 className="mt-4 text-xl font-semibold">We could not load the collection.</h3>
              <p className="mt-3 text-sm text-stone-500">{state.message}</p>
              <button onClick={reload} className="primary-button mx-auto mt-6">
                Try again
              </button>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-16 text-center">
              <Search className="mx-auto text-clay" />
              <h3 className="mt-4 text-xl font-semibold">
                {products.length ? 'No products found.' : 'Your collection starts here.'}
              </h3>
              <p className="mt-2 text-sm text-stone-500">
                {products.length
                  ? 'Try a different name.'
                  : 'Add your first product to get started.'}
              </p>
              {query && (
                <button onClick={() => setQuery('')} className="secondary-button mx-auto mt-5">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={(value) => setEditor({ product: value })}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-stone-500 sm:px-10">
          <span>
            paper & form. <span className="ml-2 text-stone-400">Everyday essentials.</span>
          </span>
          <span>Fullstack Lab · Product collection</span>
        </div>
      </footer>
      {editor && (
        <ProductForm
          product={editor.product}
          onSave={saveAndAnnounce}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <DeleteProductDialog
          product={deleting}
          onDelete={deleteAndAnnounce}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
