
const API_URL = "http://localhost:8080/api/products";

async function request(path = "", options = {}) {
  const response = await fetch(API_URL + path, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const fieldErrors = Object.values(error.errors ?? {}).join(". ");
    throw new Error(fieldErrors || error.message || `HTTP error ${response.status}`);
  }

  // A successful DELETE has no JSON response body.
  return response.status === 204 ? null : response.json();
}

const jsonOptions = (method, product) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(product),
});

export const listProducts = (name = "") =>
  request(name ? `?name=${encodeURIComponent(name)}` : "");
export const getProduct = (id) => request(`/${id}`);
export const createProduct = (product) => request("", jsonOptions("POST", product));
export const updateProduct = (id, product) => request(`/${id}`, jsonOptions("PUT", product));
export const deleteProduct = (id) => request(`/${id}`, { method: "DELETE" });
