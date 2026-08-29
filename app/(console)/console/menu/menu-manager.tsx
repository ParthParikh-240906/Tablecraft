"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  available: boolean;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "",
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

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("menu_items")
      .select("id, name, description, price, category, available")
      .eq("org_id", orgId)
      .order("category")
      .order("name")
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

  if (loading) {
    return <p className="text-sm text-[var(--ink-faint)]">Loading menu…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl">Menu</h1>
        <button type="button" onClick={startAdd} className="btn btn-accent">
          + Add item
        </button>
      </div>

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
              placeholder="Price (e.g. 12.50)"
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
          No menu items yet. Add your first one.
        </div>
      ) : (
        <ul className="rounded-sm border border-[var(--rule)] divide-y divide-[var(--rule)]">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className={`font-medium ${item.available ? "" : "line-through opacity-50"}`}>
                  {item.name}
                </p>
                <p className="text-sm text-[var(--ink-faint)]">
                  ${Number(item.price).toFixed(2)}
                  {item.category ? ` · ${item.category}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAvailable(item)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-sm border ${
                    item.available
                      ? "bg-green-900/40 text-green-300 border-green-800"
                      : "border-[var(--rule)] text-[var(--ink-faint)]"
                  }`}
                >
                  {item.available ? "Available" : "Unavailable"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="text-xs text-[var(--ink-faint)] hover:underline"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}