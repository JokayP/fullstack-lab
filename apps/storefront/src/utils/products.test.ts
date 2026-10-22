import { describe, expect, it } from 'vitest';
import { products } from '../test/fixtures';
import { filterProducts, parseProductInput } from './products';

describe('product input and search', () => {
  it('filters immediately by a trimmed partial name without changing the catalog', () => {
    expect(filterProducts(products, '  NOTE ')).toEqual([products[0]]);
    expect(filterProducts(products, '')).toHaveLength(3);
    expect(filterProducts(products, 'missing')).toEqual([]);
    expect(products).toHaveLength(3);
  });

  it('converts form strings and rejects invalid values before sending a request', () => {
    expect(parseProductInput(' Ruler ', '1.25', '0')).toEqual({
      name: 'Ruler',
      price: 1.25,
      stock: 0,
    });
    expect(() => parseProductInput(' ', '1', '1')).toThrow('name');
    for (const price of ['', '-1', '0', '1.234', 'Infinity', '100000000']) {
      expect(() => parseProductInput('Ruler', price, '1')).toThrow('price');
    }
    for (const stock of ['', '-1', '1.5', '2147483648']) {
      expect(() => parseProductInput('Ruler', '1.25', stock)).toThrow('stock');
    }
  });
});
