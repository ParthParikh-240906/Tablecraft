"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = createClient();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Scan/upload state
  const [scanMode, setScanMode] = useState<"append" | "replace">("append");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("menu_items")
      .select("id, name, description, price, category, available, sort_order, category_sort_order")
      .eq("org_id", orgId)
      .order("category_sort_order", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("menu fetch failed:", error);
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
          .single()
      : await supabase
          .from("menu_items")
          .insert({ ...payload, org_id: orgId, available: true })
          .select()
          .single();

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const saved = data as MenuItem;
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
      .select()
      .single();

    if (updateError) {
      console.error("toggle failed:", updateError);
      return;
    }
    const updated = data as MenuItem;
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function handleDelete(id: string) {
    const { error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("delete failed:", deleteError);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  async function clearAllItems() {
    const { error } = await supabase.from("menu_items").delete().eq("org_id", orgId);
    if (error) {
      console.error("clear all failed:", error);
      return;
    }
    setItems([]);
    setShowClearConfirm(false);
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
      console.error("Failed to reorder categories:", res.status, await res.text());
      return;
    }

    console.log("[MOVE CATEGORY] Success, refreshing items...");

    // Refresh items
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, description, price, category, available, sort_order, category_sort_order")
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
      console.error("Failed to move item");
      return;
    }
    // Refresh items
    const { data } = await supabase
      .from("menu_items")
      .select("id, name, description, price, category, available, sort_order, category_sort_order")
      .eq("org_id", orgId)
      .order("category_sort_order", { ascending: true })
      .order("sort_order", { ascending: true });
    setItems(data as MenuItem[]);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanError(null);
    setScanStatus("Uploading and extracting text...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("orgId", orgId);
    formData.append("mode", scanMode);

    try {
      const res = await fetch("/api/menu/vision-parse", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Scan failed");
      }

      setScanStatus(`✓ Added ${result.itemCount} items (${result.mode} mode)`);
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

  if (loading) {
    return <p className="text-sm text-[var(--ink-faint)]">Loading menu…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl">Menu</h1>
        <div className="flex gap-2">
          {/* Upload section */}
          <div className="flex items-center gap-2">
            <select
              value={scanMode}
              onChange={(e) => setScanMode(e.target.value as "append" | "replace")}
              className="input text-sm py-1.5"
              disabled={scanning}
            >
              <option value="append">Append</option>
              <option value="replace">Replace all</option>
            </select>
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
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="btn btn-error btn-outline"
            disabled={items.length === 0}
          >
            Clear menu
          </button>
        </div>
      </div>

      {/* Scan status/errors */}
      {(scanStatus || scanError) && (
        <div
          className={`p-3 mb-4 rounded-sm text-sm ${
            scanError
              ? "bg-red-900/40 text-red-400"
              : "bg-green-900/40 text-green-400"
          }`}
        >
          {scanError || scanStatus}
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
            <p className="text-sm text-red-400 rounded-sm bg-red-900/40 px-3 py-2">
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
            const seen = new Set<string>();

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
                <div className="px-4 py-2 bg-[var(--muted)] flex items-center justify-between">
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
                        <span className="font-mono text-sm">AED {item.price.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => toggleAvailable(item)}
                          className={`text-xs px-2 py-1 rounded-sm ${
                            item.available
                              ? "bg-green-900/40 text-green-400"
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
                          onClick={() => handleDelete(item.id)}
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

      {/* Clear menu confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Clear all menu items?</h3>
            <p className="text-[var(--ink-faint)] mb-4">
              This will delete {items.length} menu items permanently. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={clearAllItems}
                className="btn btn-error"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
