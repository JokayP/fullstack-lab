// Copy into src/components/ProductList.jsx in an existing React project.
import { useEffect, useState } from "react";
import { listProducts } from "../services/products-api";

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    listProducts()
      .then((data) => { if (active) setProducts(data); })
      .catch((error) => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  if (loading) return <p>Loading products...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (products.length === 0) return <p>No products found.</p>;

  return (
    <table>
      <thead>
        <tr><th>ID</th><th>Name</th><th>Price</th><th>Stock</th></tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td>{product.id}</td>
            <td>{product.name}</td>
            <td>${Number(product.price).toFixed(2)}</td>
            <td>{product.stock}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
