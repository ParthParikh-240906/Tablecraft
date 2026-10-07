"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConsoleTheme } from "../theme-wrapper";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  available: boolean;
  sort_order: number | null;
  category_sort_order: number | null;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "",
  image_url: "",
};

export function MenuManager({ orgId }: { orgId: string }) {
  const { theme } = useConsoleTheme();
  const supabase = createClient();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Scan/upload state
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [scanError, setScanError] = useState<string | null>(null);  const [deleteCatTarget, setDeleteCatTarget] = useState<string | null>(null);
  const [showDeleteCatConfirm, setShowDeleteCatConfirm] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review-before-save state (Step 2 of AI scan)
  interface PreviewRow {
    name: string;
    description: string;
    price: string;
    category: string;
    included: boolean;
  }
  const [previewItems, setPreviewItems] = useState<PreviewRow[] | null>(null);
  const [previewMode, setPreviewMode] = useState<"append" | "replace">("append");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("menu_items")
      .select("id, name, description, price, category, image_url, available, sort_order, category_sort_order")
      .eq("org_id", orgId)
      .order("category_sort_order", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) setLoadError(`Could not load menu: ${error.message}. Try again.`); else setLoadError(null);
        setItems((data ?? []) as MenuItem[]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category ?? "",
      image_url: item.image_url ?? "",
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      category: form.category.trim() || null,
      image_url: form.image_url.trim() || null,
    };

    if (!payload.name || Number.isNaN(payload.price) || payload.price < 0) {
      setError("Name and a valid price are required.");
      setSaving(false);
      return;
    }

    const { data, error: saveError } = editingId
      ? await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editingId)
          .select()
      : await supabase
          .from("menu_items")
          .insert({ ...payload, org_id: orgId, available: true })
          .select();

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const saved = Array.isArray(data) ? data[0] : (data as MenuItem);
    setItems((prev) =>
      editingId
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [...prev, saved],
    );
    setShowForm(false);
    setSaving(false);
  }

  async function toggleAvailable(item: MenuItem) {
    const { data, error: updateError } = await supabase
      .from("menu_items")
      .update({ available: !item.available })
      .eq("id", item.id)
      .select();

    if (updateError) {
      setActionError(`Could not update availability: ${updateError.message}. Try again.`);
      return;
    }
    const updated = Array.isArray(data) ? data[0] : (data as MenuItem);
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function handleDelete(id: string): Promise<boolean> {
    setActionError(null);
    const { error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setActionError(`Could not delete item: ${deleteError.message}. Try again.`);
      return false;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    return true;
  };

  async function deleteCategory() {
    if (!deleteCatTarget) return;
    let query = supabase
      .from("menu_items")
      .delete()
      .eq("org_id", orgId);
    if (deleteCatTarget === "Uncategorized") {
      query = query.is("category", null);
    } else {
      query = query.eq("category", deleteCatTarget);
    }
    const { error } = await query;
    if (error) {
      setActionError(`Could not delete category: ${error.message}. Try again.`);
      return;
    }
    setItems((prev) => prev.filter((i) => (i.category || "Uncategorized") !== deleteCatTarget));
    setDeleteCatTarget(null);
    setShowDeleteCatConfirm(false);
  }

  async function moveCategory(category: string, direction: "up" | "down") {
    console.log("[MOVE CATEGORY] Called:", category, direction);
    console.log("[MOVE CATEGORY] Current items:", items.length);

    // Get current items sorted by category_sort_order
    const sortedItems = [...items].sort((a, b) => {
      const catA = a.category_sort_order ?? 0;
      const catB = b.category_sort_order ?? 0;
      return catA - catB;
    });

    // Find unique categories in order
    const categoryOrder: string[] = [];
    const seen = new Set<string>();
    for (const item of sortedItems) {
      const cat = item.category || "Other";
      if (!seen.has(cat)) {
        categoryOrder.push(cat);
        seen.add(cat);
      }
    }

    const currentIndex = categoryOrder.indexOf(category);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categoryOrder.length) return;

    // Swap the two categories
    const swapped = [...categoryOrder];
    [swapped[currentIndex], swapped[newIndex]] = [swapped[newIndex], swapped[currentIndex]];

    // Reorder all categories using swapped order
    const updates = swapped.map((cat, idx) => ({
      category: cat,
      category_sort_order: idx,
    }));

    const res = await fetch("/api/menu/categories/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: updates, org_id: orgId }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      setActionError(`Could not reorder categories (${res.status}). ${msg} Try again.`);
      return;
    }

    console.log("[MOVE CATEGORY] Success, refreshing items...");

    // Refresh items
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, description, price, category, image_url, available, sort_order, category_sort_order")
      .eq("org_id", orgId)
      .order("category_sort_order", { ascending: true })
      .order("sort_order", { ascending: true });

    console.log("[MOVE CATEGORY] Fetched items:", data?.length, "error:", error);

    if (data) {
      setItems(data as MenuItem[]);
    }
  }

  async function moveItem(id: string, direction: "up" | "down") {
    const res = await fetch(`/api/menu/items/${id}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!res.ok) {
      setActionError(`Could not move item (${res.status}). Try again.`);
      return;
    }
    // Refresh items
    const { data } = await supabase
      .from("menu_items")
      .select("id, name, description, price, category, image_url, available, sort_order, category_sort_order")
      .eq("org_id", orgId)
      .order("category_sort_order", { ascending: true })
      .order("sort_order", { ascending: true });
    setItems(data as MenuItem[]);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setScanError("File exceeds 5MB — compress the image and try again.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setScanning(true);
    setScanError(null);
    setScanStatus("Uploading and extracting text...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("orgId", orgId);
    // Scanned menus always append to the existing menu.
    formData.append("mode", "append");
    // Preview first: extract without inserting, then review before saving.
    formData.append("preview", "true");

    try {
      const res = await fetch("/api/menu/vision-parse", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Scan failed");
      }

      // Preview path: show the review-before-save step (no DB writes yet).
      if (result.preview === true && Array.isArray(result.items)) {
        const rows: PreviewRow[] = result.items.map(
          (item: { name?: unknown; description?: unknown; price?: unknown; category?: unknown }) => ({
            name: typeof item.name === "string" ? item.name : String(item.name ?? ""),
            description: typeof item.description === "string" ? item.description : "",
            price: item.price != null ? String(item.price) : "",
            category: typeof item.category === "string" ? item.category : "",
            included: true,
          })
        );
        if (rows.length === 0) {
          setScanError("No items found in scan — try a clearer image.");
        } else {
          setPreviewItems(rows);
          setPreviewMode("append");
          setScanStatus(`Detected ${rows.length} items — review below, then confirm.`);
        }
        return;
      }

      // Backward-compatible direct-insert path (route without preview).
      if (!result.itemCount || result.itemCount === 0) { setScanError("No items found in scan — try a clearer image."); } else { setScanStatus(`✓ Added ${result.itemCount} items`); }
      // Refresh menu list
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, description, price, category, available")
        .eq("org_id", orgId);
      setItems(data as MenuItem[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process file";
      setScanError(message);
    } finally {
      setScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function updatePreviewRow(index: number, patch: Partial<PreviewRow>) {
    setPreviewItems((prev) =>
      prev ? prev.map((row, i) => (i === index ? { ...row, ...patch } : row)) : prev
    );
  }

  async function handleConfirmPreview() {
    if (!previewItems) return;
    const selected = previewItems.filter((row) => row.included);
    if (selected.length === 0) {
      setScanError("Select at least one item to add.");
      return;
    }
    const payload: Array<{ name: string; description?: string; price: number; category?: string }> = [];
    for (const row of selected) {
      const name = row.name.trim();
      const price = Number(row.price);
      if (!name || !Number.isFinite(price) || price < 0) {
        setScanError(`Fix invalid row: "${row.name.trim() || "(unnamed)"}" needs a name and a valid price.`);
        return;
      }
      payload.push({
        name,
        description: row.description.trim() || undefined,
        price,
        category: row.category.trim() || undefined,
      });
    }
    if (previewMode === "replace") {
      const ok = window.confirm(
        `Replace mode will DELETE all ${items.length} existing menu items and insert only the ${payload.length} selected scanned items. This cannot be undone. Continue?`
      );
      if (!ok) return;
    }
    setConfirming(true);
    setScanError(null);
    setScanStatus(previewMode === "replace" ? "Replacing menu…" : "Adding reviewed items…");
    try {
      const confirmData = new FormData();
      confirmData.append("orgId", orgId);
      confirmData.append("mode", previewMode);
      confirmData.append("items", JSON.stringify(payload));
      const res = await fetch("/api/menu/vision-parse", {
        method: "POST",
        body: confirmData,
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Save failed");
      }
      setScanStatus(`✓ Added ${result.itemCount} items`);
      setPreviewItems(null);
      // Refresh menu list
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, description, price, category, available")
        .eq("org_id", orgId);
      setItems(data as MenuItem[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save items";
      setScanError(message);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-faint)]">Loading menu…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl">Menu</h1>
        <div className="flex gap-2">
          {/* Upload section — scanned menus always append */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
              disabled={scanning}
              className="hidden"
              id="menu-file-upload"
            />
            <label
              htmlFor="menu-file-upload"
              className="btn btn-outline cursor-pointer disabled:opacity-50"
            >
              {scanning ? "Processing…" : "Scan menu"}
            </label>
            <span className="text-xs text-[var(--ink-faint)]">
              (max 5MB recommended)
            </span>
          </div>
          <button type="button" onClick={startAdd} className="btn btn-accent">
            + Add item
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
          <span>{loadError}</span>
          <button type="button" onClick={() => window.location.reload()} className="underline shrink-0">Retry</button>
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="underline shrink-0">Dismiss</button>
        </div>
      )}

      {/* Scan status/errors */}
      {(scanStatus || scanError) && (
        <div
          className={`p-3 mb-4 rounded-sm text-sm ${
            scanError
              ? theme === "light" ? "bg-red-600 text-white" : "bg-red-900/40 text-red-400"
              : theme === "light" ? "bg-green-600 text-white" : "bg-green-900/40 text-green-400"
          }`}
        >
          {scanError || scanStatus}
        </div>
      )}

      {/* Review-before-save step: editable preview of scanned items */}
      {previewItems && (
        <div className="ticket p-5 mb-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium text-sm">
              Review scanned items — {previewItems.length} detected (
              {previewItems.filter((row) => row.included).length} selected)
            </h2>
            <button
              type="button"
              onClick={() =>
                setPreviewItems((prev) => {
                  const allIncluded = (prev ?? []).length > 0 && (prev ?? []).every((row) => row.included);
                  return (prev ?? []).map((row) => ({ ...row, included: !allIncluded }));
                })
              }
              className="btn btn-ghost text-xs py-1"
            >
              {previewItems.length > 0 && previewItems.every((row) => row.included)
                ? "Select none"
                : "Select all"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--ink-faint)]">Mode:</span>
            <button
              type="button"
              onClick={() => setPreviewMode("append")}
              className={`btn text-xs py-1 ${previewMode === "append" ? "btn-accent" : "btn-outline"}`}
            >
              Append
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("replace")}
              className={`btn text-xs py-1 ${previewMode === "replace" ? "btn-accent" : "btn-outline"}`}
            >
              Replace
            </button>
          </div>
          {previewMode === "replace" && (
            <p className={`text-sm rounded-sm px-3 py-2 ${theme === "light" ? "bg-red-600 text-white" : "text-red-400 bg-red-900/40"}`}>
              Replace will delete all {items.length} existing menu items and insert only the
              selected scanned items. This cannot be undone.
            </p>
          )}
          <ul className="space-y-2">
            {previewItems.map((row, index) => (
              <li
                key={index}
                className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:items-center rounded-sm border border-[var(--rule)] p-2"
              >
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={(e) => updatePreviewRow(index, { included: e.target.checked })}
                  title="Include this item"
                  className="sm:col-span-1 justify-self-start"
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={row.name}
                  onChange={(e) => updatePreviewRow(index, { name: e.target.value })}
                  className="input sm:col-span-3"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price (AED)"
                  value={row.price}
                  onChange={(e) => updatePreviewRow(index, { price: e.target.value })}
                  className="input sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={row.category}
                  onChange={(e) => updatePreviewRow(index, { category: e.target.value })}
                  className="input sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={row.description}
                  onChange={(e) => updatePreviewRow(index, { description: e.target.value })}
                  className="input sm:col-span-3"
                />
                <button
                  type="button"
                  onClick={() => setPreviewItems((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))}
                  className="btn btn-ghost text-xs py-1 text-red-400 sm:col-span-1"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {previewItems.length === 0 && (
            <p className="text-sm text-[var(--ink-faint)]">All rows removed — go back and scan again, or add items manually.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmPreview}
              disabled={confirming || scanning}
              className="btn btn-accent"
            >
              {confirming
                ? "Saving…"
                : previewMode === "replace"
                  ? `Replace with ${previewItems.filter((row) => row.included).length} items`
                  : `Add ${previewItems.filter((row) => row.included).length} items`}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewItems(null);
                setScanStatus("");
              }}
              className="btn btn-outline"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="ticket p-5 mb-6 space-y-3"
        >
          <h2 className="font-medium text-sm">
            {editingId ? "Edit item" : "New item"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="input"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Price in AED (e.g. 45.00)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
              className="input"
            />
            <input
              type="text"
              placeholder="Category (e.g. Mains)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
            />
            <input
              type="url"
              placeholder="Image URL (optional, e.g. https://...)"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className="input sm:col-span-2"
            />
          </div>
          {error && (
            <p className={`text-sm rounded-sm px-3 py-2 ${theme === "light" ? "bg-red-600 text-white" : "text-red-400 bg-red-900/40"}`}> 
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-accent">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[var(--rule)] p-10 text-center text-[var(--ink-faint)]">
          No menu items yet. Add your first one or scan a menu PDF/image.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group items by category */}
          {(() => {
            const grouped: Record<string, MenuItem[]> = {};
            const categoryOrder: string[] = [];

            for (const item of items) {
              const cat = item.category || "Uncategorized";
              if (!grouped[cat]) {
                grouped[cat] = [];
                categoryOrder.push(cat);
              }
              grouped[cat].push(item);
            }

            return categoryOrder.map((cat, catIdx) => (
              <div key={cat} className="rounded-sm border border-[var(--rule)]">
                {/* Category header with reorder buttons */}
                <div className={`px-4 py-2 flex items-center justify-between ${theme === "light" ? "bg-[var(--layer2)]" : "bg-[var(--muted)]"}`}> 
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{cat}</span>
                    <span className="text-xs text-[var(--ink-faint)]">({grouped[cat].length} items)</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveCategory(cat, "up")}
                      disabled={catIdx === 0}
                      className="btn btn-ghost btn-xs p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                      title="Move category up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(cat, "down")}
                      disabled={catIdx === categoryOrder.length - 1}
                      className="btn btn-ghost btn-xs p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                      title="Move category down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteCatTarget(cat);
                        setShowDeleteCatConfirm(true);
                      }}
                      className="btn btn-ghost btn-xs p-1 text-red-400 opacity-50 hover:opacity-100"
                      title={`Delete ${cat} category`}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Items in category */}
                <ul className="divide-y divide-[var(--rule)]">
                  {grouped[cat].map((item, idx) => (
                    <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {/* Move up/down buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveItem(item.id, "up")}
                            disabled={idx === 0}
                            className="btn btn-ghost btn-xs p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(item.id, "down")}
                            disabled={idx === grouped[cat].length - 1}
                            className="btn btn-ghost btn-xs p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-sm"
                          />
                        )}
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.category && (
                            <p className="text-xs text-[var(--ink-faint)]">{item.category}</p>
                          )}
                          {item.description && (
                            <p className="text-xs text-[var(--ink-muted)] mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">AED {(() => { const n = Number(item.price); return Number.isFinite(n) ? n.toFixed(2) : "0.00"; })()}</span>
                        <button
                          type="button"
                          onClick={() => toggleAvailable(item)}
                          className={`text-xs px-2 py-1 rounded-sm ${
                            item.available
                              ? theme === "light"
                                ? "bg-green-600 text-white"
                                : "bg-green-900/40 text-green-400"
                              : theme === "light"
                                ? "bg-slate-500 text-white"
                                : "bg-[var(--muted)] text-[var(--ink-muted)]"
                          }`}
                        >
                          {item.available ? "Available" : "Unavailable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="btn btn-ghost text-xs py-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteItemTarget(item)}
                          className="btn btn-ghost text-xs py-1 text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Delete category confirmation modal */}
      {showDeleteCatConfirm && deleteCatTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete category?</h3>
            <p className="text-[var(--ink-faint)] mb-4">
              Are you sure you want to delete &ldquo;{deleteCatTarget}&rdquo; category?
              This will remove all its items and cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDeleteCatConfirm(false);
                  setDeleteCatTarget(null);
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={deleteCategory}
                className="btn btn-error"
              >
                Delete category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete menu item confirmation modal */}
      {deleteItemTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete menu item?</h3>
            <p className="text-[var(--ink-faint)] mb-4">
              Are you sure you want to delete &ldquo;{deleteItemTarget.name}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteItemTarget(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await handleDelete(deleteItemTarget.id);
                  if (ok) setDeleteItemTarget(null);
                }}
                className="btn btn-error"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}