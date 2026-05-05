import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Loader2,
  Search,
  Tag,
  PhilippinePeso,
  X,
  AlertTriangle,
} from "lucide-react";
import { Modal, notification } from "antd";

import {
  getProducts,
  saveProduct,
  deleteProduct,
  type Product,
} from "../utils/storage";

const useNotify = () => {
  const [api, contextHolder] = notification.useNotification();

  const notify = useCallback(
    (
      type: "success" | "error" | "info" | "warning",
      title: string,
      description?: string
    ) => {
      const config = {
        title,
        description,
        placement: "topRight" as const,
      };

      if (type === "success") api.success(config);
      else if (type === "error") api.error(config);
      else if (type === "warning") api.warning(config);
      else api.info(config);
    },
    [api]
  );

  return { notify, contextHolder };
};

export function Products() {
  const { notify, contextHolder } = useNotify();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();

    setFilteredProducts(
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category?.toLowerCase() || "").includes(q)
      )
    );
  }, [searchQuery, products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
      notify(
        "error",
        "Failed to load products",
        "Check your Firebase connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      price: "",
      category: "",
    });
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category || "",
    });
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: (
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          Delete Product
        </div>
      ),
      content: (
        <p className="text-slate-600">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-900">"{name}"</span>? This
          action cannot be undone.
        </p>
      ),
      okText: "Delete",
      cancelText: "Cancel",
      okType: "danger",
      okButtonProps: {
        className: "bg-red-600 hover:bg-red-700",
      },
      onOk: async () => {
        try {
          await deleteProduct(id);
          await loadProducts();

          notify("success", "Product deleted", `"${name}" has been removed.`);
        } catch (error) {
          console.error("Failed to delete product:", error);
          notify("error", "Failed to delete product");
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    const name = formData.name.trim();
    const category = formData.category.trim();
    const price = Number(formData.price);

    if (!name) {
      notify("warning", "Invalid product name", "Product name is required.");
      return;
    }

    if (isNaN(price) || price <= 0) {
      notify("warning", "Invalid price", "Enter a valid price greater than 0.");
      return;
    }

    const product: Product = {
      id: editingProduct?.id || Date.now().toString(),
      name,
      price,
      category: category || undefined,
    };

    try {
      setSubmitting(true);

      await saveProduct(product);
      await loadProducts();

      setShowModal(false);
      setEditingProduct(null);
      setFormData({
        name: "",
        price: "",
        category: "",
      });

      notify(
        "success",
        editingProduct ? "Product updated" : "Product added",
        editingProduct
          ? `"${name}" has been updated successfully.`
          : `"${name}" has been added successfully.`
      );
    } catch (error) {
      console.error("Failed to save product:", error);
      notify("error", "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;

    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      price: "",
      category: "",
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      {contextHolder}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Products
          </h2>

          <p className="text-sm text-slate-500 mt-0.5">
            Manage your canteen menu items
          </p>
        </div>

        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 
          text-white font-medium rounded-xl hover:bg-blue-700 
          active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

        <input
          type="text"
          placeholder="Search products or categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl
          text-slate-900 placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          transition-all"
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 
            text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />

            <p className="text-slate-500 font-medium">
              {searchQuery ? "No products match your search" : "No products yet"}
            </p>

            <p className="text-sm text-slate-400 mt-1">
              {searchQuery
                ? "Try a different search term"
                : 'Click "Add Product" to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {product.name}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {product.category ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                            <Tag className="w-3 h-3" />
                            {product.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          ₱{product.price.toLocaleString()}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 
                            rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(product.id, product.name)
                            }
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 
                            rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors active:bg-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {product.name}
                      </h3>

                      <div className="flex items-center gap-2 mt-1.5">
                        {product.category && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Tag className="w-3 h-3" />
                            {product.category}
                          </span>
                        )}

                        <span className="text-sm font-bold text-slate-900">
                          ₱{product.price.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 
                        rounded-xl transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(product.id, product.name)
                        }
                        className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 
                        rounded-xl transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && products.length > 0 && (
        <p className="text-xs text-slate-400 mt-4 text-center">
          Showing {filteredProducts.length} of {products.length} product
          {products.length !== 1 ? "s" : ""}
        </p>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto
              animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingProduct ? "Edit Product" : "Add Product"}
                  </h3>

                  <p className="text-sm text-slate-500 mt-0.5">
                    {editingProduct
                      ? "Update the product details below"
                      : "Fill in the details for the new product"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 
                  rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Product Name
                  </label>

                  <input
                    type="text"
                    placeholder="e.g. Chicken Adobo"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl
                    text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                    focus:border-blue-500 transition-all"
                    required
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Price (₱)
                    </label>

                    <div className="relative">
                      <PhilippinePeso className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                      <input
                        type="number"
                        placeholder="50"
                        min="0"
                        step="1"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl
                        text-slate-900 placeholder-slate-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                        focus:border-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Category
                    </label>

                    <input
                      type="text"
                      placeholder="e.g. Meal"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl
                      text-slate-900 placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                      focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl
                    font-medium text-slate-700 hover:bg-slate-50 
                    transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium
                    rounded-xl hover:bg-blue-700 active:scale-[0.98]
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>{editingProduct ? "Update" : "Save"} Product</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}