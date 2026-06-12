import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useCurrency } from "../lib/currency";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, canAccess } from "../lib/auth";

const CATEGORIES = ["water", "soft_drink", "juice", "energy_drink", "snack", "premium_beverage", "custom"];

function ProductDialog({ existing, onDone }) {
  const [open, setOpen] = useState(false);
  const { symbol } = useCurrency();
  const [form, setForm] = useState(existing || {
    name: "", category: "soft_drink", brand: "", bottle_size: "330ml",
    sku: "", selling_price: 0, tax_rate: 18, image_url: "", description: "",
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (existing) {
        await api.patch(`/products/${existing.id}`, form);
        toast.success("Product updated", { description: form.name });
      } else {
        await api.post("/products", form);
        toast.success("Product added", { description: form.name });
      }
      setOpen(false);
      onDone?.();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing
          ? <button className="smallcaps ink-link text-ink-600" data-testid={`edit-product-${existing.id}`}><Edit className="w-3 h-3" /></button>
          : <button className="smallcaps ink-link text-ink-900 flex items-center gap-2" data-testid="add-product-button"><Plus className="w-3 h-3" /> Add product</button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl">
        <DialogHeader><DialogTitle asChild><h3 className="font-display text-3xl">{existing ? "Edit product" : "New product"}</h3></DialogTitle></DialogHeader>
        <div className="hairline my-4" />
        <form onSubmit={submit} className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          <div><label className="smallcaps">Name</label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" data-testid="product-name-input" /></div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="smallcaps">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="border-0 border-b border-ink-200 rounded-none px-0 mt-2 text-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="smallcaps">Brand</label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" /></div>
          </div>
          <div className="grid grid-cols-3 gap-5">
            <div><label className="smallcaps">Size</label><Input value={form.bottle_size} onChange={(e) => setForm({ ...form, bottle_size: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-base" /></div>
            <div><label className="smallcaps">SKU</label><Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-base font-mono" /></div>
            <div><label className="smallcaps">Tax %</label><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-base font-mono tabular" /></div>
          </div>
          <div>
            <label className="smallcaps">Selling price ({symbol})</label>
            <Input required type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: parseFloat(e.target.value) })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-2xl font-display tabular" data-testid="product-price-input" />
          </div>
          <div>
            <label className="smallcaps">Image URL</label>
            <Input value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-sm font-mono" />
          </div>
          <button type="submit" className="w-full py-3.5 btn-apple btn-apple-primary" data-testid="submit-product">{existing ? "Save" : "Create"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ product, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/products/${product.id}`);
      toast.success("Product deleted", { description: product.name });
      onConfirm();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl max-w-md">
        <DialogHeader>
          <DialogTitle asChild>
            <h3 className="font-display text-3xl font-medium tracking-display-tight">Delete product</h3>
          </DialogTitle>
        </DialogHeader>
        <div className="hairline my-4" />
        <p className="text-ink-900 mb-6">
          Are you sure you want to delete <span className="font-bold">{product?.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3.5 btn-apple border border-ink-200 text-ink-900"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-3.5 btn-apple bg-brand text-white hover:bg-brand/90"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const { role } = useAuth();
  const { format } = useCurrency();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products");
      setProducts(data);
    } catch (err) { console.warn("Products fetch failed:", err); }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const toggleActive = async (p) => {
    try {
      await api.patch(`/products/${p.id}`, { active: !p.active });
      fetchProducts();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  const handleDelete = (p) => {
    setDeletingProduct(p);
  };

  const handleDeleteConfirm = () => {
    setDeletingProduct(null);
    fetchProducts();
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${products.length} items in the catalogue · ${products.filter(p => p.active).length} on offer`}
        title={<>The catalogue,<br /><span className="italic text-brand">curated.</span></>}
        lead="Each bottle, each snack, with its own number and tax. The price written quietly beneath the image."
        right={canAccess(role, ["hotel_admin"]) && <ProductDialog onDone={fetchProducts} />}
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : (
        /* Magazine grid – asymmetric, no enclosing boxes */
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
          {products.map((p, i) => (
            <article key={p.id} className="group" data-testid={`product-card-${p.id}`}>
              <div className="aspect-[4/5] overflow-hidden bg-cream-deep mb-4 relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display italic text-ink-400">No image</div>
                )}
                {!p.active && (
                  <div className="absolute inset-0 bg-cream/85 flex items-center justify-center">
                    <span className="smallcaps text-ink-900">Inactive</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="smallcaps text-ink-400">№ {(i + 1).toString().padStart(3, "0")} · {p.category.replace("_", " ")}</p>
                <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                <p className="font-display-text italic text-ink-600 text-sm">{p.brand} · {p.bottle_size}</p>
                <div className="hairline-soft my-3" />
                <div className="flex items-baseline justify-between">
                  <span className="ticking-num text-3xl text-ink-900">{format(p.selling_price)}</span>
                  <span className="smallcaps text-ink-400 font-mono">+{p.tax_rate}% tax</span>
                </div>
                {canAccess(role, ["hotel_admin"]) && (
                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-hairline-soft">
                    <div className="flex items-center gap-2">
                      <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} data-testid={`toggle-product-${p.id}`} />
                      <span className="smallcaps">{p.active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <ProductDialog existing={p} onDone={fetchProducts} />
                      <button onClick={() => handleDelete(p)} className="smallcaps ink-link text-oxblood" data-testid={`delete-product-${p.id}`}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {deletingProduct && <DeleteConfirmDialog product={deletingProduct} onConfirm={handleDeleteConfirm} onClose={() => setDeletingProduct(null)} />}
    </div>
  );
}
