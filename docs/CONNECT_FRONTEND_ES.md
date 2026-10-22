# Conectar el frontend con la versión en inglés

El proyecto actualizado se llama `fullstack-lab`. Usa su nuevo JAR y sus nuevos ejemplos. La explicación está en español; el código y todos los ejemplos están en inglés.

La tienda Paper & Form ya se conecta a este backend y guarda productos. Portal consume la API externa de Rick and Morty.

## 1. Arranca el backend nuevo

Si el anterior sigue abierto, detenlo con Ctrl+C para liberar el puerto 8080. Dentro de la carpeta nueva ejecuta:

```powershell
.\mvnw.cmd --batch-mode --no-transfer-progress clean verify
java -jar .\target\products-crud-1.0.0.jar --spring.profiles.active=h2
```

La compilación requiere JDK 21 configurado en JAVA_HOME. El repositorio no incluye JAR ni Java; ambos se preparan localmente.

Si llevas Java portátil dentro de una carpeta `java`, usa:

```powershell
.\java\bin\java.exe -jar .\target\products-crud-1.0.0.jar --spring.profiles.active=h2
```

También puedes abrir `start-demo.cmd`. Abre en el navegador:

```text
http://localhost:8080/api/products
```

La respuesta tendrá esta estructura:

```json
[
  { "id": 1, "name": "Notebook", "price": 2.5, "stock": 20 },
  { "id": 2, "name": "Pencil", "price": 0.5, "stock": 50 },
  { "id": 3, "name": "Backpack", "price": 18.9, "stock": 8 }
]
```

Los IDs dependen de los registros existentes. El listado es un arreglo directamente, no un objeto con una propiedad `products`.

## 2. Encuentra dónde consulta datos el frontend del profesor

Abre la carpeta del frontend en VS Code. Presiona Ctrl+Shift+F y busca `fetch`, `axios` o `API_URL`. La búsqueda recorre todos los archivos; no necesitas adivinar el nombre.

Por ejemplo, podrías encontrar en `src/services/products-api.js`:

```javascript
const API_URL = 'http://localhost:3000/products';
```

Para este backend, el valor debe ser:

```javascript
const API_URL = 'http://localhost:8080/api/products';
```

Si el código usa una base compartida y añade la ruta después, revisa ambas partes para no duplicar `/api/products`. Ejemplo válido:

```javascript
const API_URL = 'http://localhost:8080/api';
const response = await fetch(`${API_URL}/products`);
```

Si usa Axios, una consulta válida es:

```javascript
const response = await axios.get('http://localhost:8080/api/products');
setProducts(response.data);
```

Axios ya entrega el JSON convertido en `response.data`. Con Fetch debes usar `await response.json()`.

## 3. Si todavía no tiene conexión, copia estos archivos

Dentro del frontend existente, la estructura quedaría así:

```text
src/
  App.jsx
  services/
    products-api.js
  components/
    ProductList.jsx
```

- Copia `examples/products-api.js` a `src/services/products-api.js`.
- Copia `examples/ProductList.jsx` a `src/components/ProductList.jsx`.
- Usa `examples/App.jsx` como referencia para importar y mostrar ProductList en tu App existente.

No reemplaces a ciegas el trabajo del profesor. Adapta su consulta o agrega el componente donde corresponda. Los archivos `.jsx` requieren un proyecto React; no se abren como HTML mediante doble clic.

## 4. Qué hace cada archivo

En `src/services/products-api.js`, la función pública para listar es:

```javascript
export const listProducts = (name = '') => request(name ? `?name=${encodeURIComponent(name)}` : '');
```

`listProducts()` pide todos los productos. `listProducts("back")` busca por nombre. La función interna `request` llama a Fetch, revisa errores y convierte el JSON.

En `src/components/ProductList.jsx`, este fragmento guarda la respuesta:

```javascript
listProducts()
  .then((data) => {
    if (active) setProducts(data);
  })
  .catch((error) => {
    if (active) setError(error.message);
  })
  .finally(() => {
    if (active) setLoading(false);
  });
```

El archivo completo define `active`, `setProducts`, `setError` y `setLoading`. `active` evita actualizar el estado de un componente que ya se desmontó.

Después se muestran las propiedades recibidas:

```jsx
{
  products.map((product) => (
    <tr key={product.id}>
      <td>{product.id}</td>
      <td>{product.name}</td>
      <td>{product.price}</td>
      <td>{product.stock}</td>
    </tr>
  ));
}
```

`products` es la lista completa y `product` es un elemento de esa lista. `name` es el nombre; `price`, el precio; `stock`, las unidades.

## 5. Crear, editar y eliminar

Estas funciones ya están implementadas en `products-api.js`. Ejemplo de cómo llamarlas desde un módulo:

```javascript
import { createProduct, updateProduct, deleteProduct } from './services/products-api';

async function runExample() {
  try {
    const product = await createProduct({ name: 'Ruler', price: 1.25, stock: 10 });
    await updateProduct(product.id, { name: 'Large ruler', price: 1.75, stock: 12 });
    await deleteProduct(product.id);
  } catch (error) {
    console.error(error.message);
  }
}
```

El ejemplo define la función, pero no la ejecuta automáticamente. En una interfaz real llamarías cada operación desde el botón correspondiente y volverías a cargar la lista después de guardar o eliminar.

| Acción            | Petición                    | Respuesta                |
| ----------------- | --------------------------- | ------------------------ |
| Listar            | GET /api/products           | 200 y arreglo JSON       |
| Buscar por nombre | GET /api/products?name=back | 200 y arreglo JSON       |
| Consultar uno     | GET /api/products/{id}      | 200 y objeto JSON        |
| Crear             | POST /api/products          | 201 y objeto con ID      |
| Editar            | PUT /api/products/{id}      | 200 y objeto actualizado |
| Eliminar          | DELETE /api/products/{id}   | 204 sin cuerpo           |

Para crear o editar, el JSON debe tener `name`, `price` y `stock`. El backend genera el ID. `price` y `stock` deben ser números; convierte los textos de los campos del formulario con `Number(...)` después de comprobar que no estén vacíos.

## 6. Si no funciona

1. Abre primero `/api/products` en el navegador. Si falla, resuelve el arranque del backend antes de editar React.
2. Revisa que el frontend use el mismo puerto y la ruta completa.
3. Revisa las propiedades `name` y `price` en el JSON y en el componente.
4. Si funciona en Postman pero el navegador muestra un error CORS, revisa el origen del frontend. Están permitidos localhost y 127.0.0.1 con puertos 5173 y 3000.
5. No dejes la versión anterior ocupando el puerto 8080.

La explicación oral: «My frontend calls the products API using HTTP. Spring Boot handles the request, reads or writes the database, and returns JSON. The frontend stores the response in state and renders the products».
