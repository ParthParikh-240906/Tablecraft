"use client";

import { useRef, useState } from "react";
import type { InventoryScanLine } from "@/types/inventory";

type PreviewRow = InventoryScanLine & {
  included: boolean;
  editQuantity: string;
  editUnit: string;
  editPar: string;
  createNew: boolean;
};

type Props = {
  orgId: string;
  onClose: () => void;
  onDone: () => void;
};

export function InventoryScanModal({ orgId, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busyStatus, setBusyStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB — compress the photo and try again.");
      return;
    }
    setScanning(true);
    setError(null);
    setResult(null);
    setBusyStatus("Reading the bill/list…");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("orgId", orgId);
    formData.append("preview", "true");

    try {
      const res = await fetch("/api/inventory/scan", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not read the bill/list.");
        return;
      }
      const lines = Array.isArray(data?.lines) ? (data.lines as InventoryScanLine[]) : [];
      if (lines.length === 0) {
        setError("No purchased items found. Try a clearer photo.");
        return;
      }
      setRows(
        lines.map((line) => ({
          ...line,
          included: true,
          editQuantity: String(line.quantity ?? ""),
          editUnit: line.unit || "each",
          editPar: line.par_level != null ? String(line.par_level) : "",
          createNew: !line.matched_item_id,
        })),
      );
      setBusyStatus(`Found ${lines.length} purchased line${lines.length === 1 ? "" : "s"} — review below.`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setScanning(false);
    }
  }

  function updateRow(index: number, patch: Partial<PreviewRow>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  }

  async function handleConfirm() {
    if (!rows) return;
    const selected = rows.filter((r) => r.included);
    if (selected.length === 0) {
      setError("Select at least one line.");
      return;
    }

    for (const row of selected) {
      const qty = Number(row.editQuantity);
      if (!row.name.trim() || !Number.isFinite(qty) || qty <= 0) {
        setError(`Fix the quantity for "${row.name || "(unnamed)"}".`);
        return;
      }
      if (!row.editUnit.trim()) {
        setError(`Choose a unit for "${row.name}".`);
        return;
      }
    }

    setConfirming(true);
    setError(null);
    setResult(null);

    const payload = selected.map((row) => ({
      name: row.name.trim(),
      quantity: Number(row.editQuantity),
      unit: row.editUnit.trim(),
      matched_item_id: row.createNew ? null : row.matched_item_id ?? null,
      create_new: row.createNew,
      category: row.category ?? null,
      par_level: row.editPar.trim() === "" ? null : Number(row.editPar),
      unit_price: row.unit_price ?? null,
    }));

    try {
      const res = await fetch("/api/inventory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, lines: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not add the scanned items.");
        return;
      }
      setResult(
        `Added ${data.itemCount ?? selected.length} lines · ${data.created ?? 0} new ingredients · ${data.updated ?? 0} matched.`,
      );
      onDone();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-5xl ticket p-5 space-y-4 my-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Scan a bill or shopping list</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              Photograph a supplier receipt, invoice, or handwritten list. Review every line before adding stock.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs py-1">
            Close
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0] ?? null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />

        {!rows && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`rounded-sm border border-dashed p-10 text-center transition-colors ${
              dragOver ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--rule)]"
            }`}
          >
            <p className="text-sm font-medium">Drop a photo here, or choose one</p>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              JPG, PNG, or WebP. Printed receipts and handwritten lists both work.
            </p>
            <button
              type="button"
              disabled={scanning}
              onClick={() => fileRef.current?.click()}
              className="btn btn-accent mt-4"
            >
              {scanning ? "Reading…" : "Choose photo"}
            </button>
            {busyStatus && <p className="text-xs text-[var(--ink-soft)] mt-3">{busyStatus}</p>}
          </div>
        )}

        {error && (
          <p className="text-sm rounded-sm bg-red-600 text-white px-3 py-2">{error}</p>
        )}
        {result && (
          <p className="text-sm rounded-sm bg-green-700 text-white px-3 py-2">{result}</p>
        )}

        {rows && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Review {rows.length} line{rows.length === 1 ? "" : "s"} —{" "}
                {rows.filter((r) => r.included).length} selected
              </p>
              <button
                type="button"
                className="btn btn-ghost text-xs py-1"
                onClick={() =>
                  setRows((prev) => {
                    if (!prev) return prev;
                    const all = prev.every((r) => r.included);
                    return prev.map((r) => ({ ...r, included: !all }));
                  })
                }
              >
                {rows.every((r) => r.included) ? "Select none" : "Select all"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-[var(--ink-soft)] border-b border-[var(--rule)]">
                    <th className="p-2">Use</th>
                    <th className="p-2">Ingredient</th>
                    <th className="p-2">Match</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Unit</th>
                    <th className="p-2">Par</th>
                    <th className="p-2">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b border-[var(--rule)] align-top">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={(e) => updateRow(index, { included: e.target.checked })}
                        />
                      </td>
                      <td className="p-2 min-w-[180px]">
                        <input
                          className="input py-1"
                          value={row.name}
                          onChange={(e) => updateRow(index, { name: e.target.value })}
                        />
                        {row.confidence && (
                          <span className="text-[10px] text-[var(--ink-faint)]">{row.confidence} confidence</span>
                        )}
                      </td>
                      <td className="p-2 min-w-[150px]">
                        {row.matched_item_id && !row.createNew ? (
                          <div>
                            <p className="text-[var(--ink-soft)]">Existing: {row.matched_name}</p>
                            <label className="flex items-center gap-1 mt-1 text-[10px] text-[var(--ink-faint)]">
                              <input
                                type="checkbox"
                                checked={row.createNew}
                                onChange={(e) => updateRow(index, { createNew: e.target.checked })}
                              />
                              Create new instead
                            </label>
                          </div>
                        ) : (
                          <span className="text-amber-700">New ingredient</span>
                        )}
                      </td>
                      <td className="p-2 w-24">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="input py-1"
                          value={row.editQuantity}
                          onChange={(e) => updateRow(index, { editQuantity: e.target.value })}
                        />
                      </td>
                      <td className="p-2 w-24">
                        <input
                          className="input py-1"
                          value={row.editUnit}
                          onChange={(e) => updateRow(index, { editUnit: e.target.value })}
                          placeholder="kg"
                        />
                      </td>
                      <td className="p-2 w-24">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="input py-1"
                          value={row.editPar}
                          onChange={(e) => updateRow(index, { editPar: e.target.value })}
                          placeholder="optional"
                        />
                      </td>
                      <td className="p-2 min-w-[120px]">
                        <input
                          className="input py-1"
                          value={row.category ?? ""}
                          onChange={(e) => updateRow(index, { category: e.target.value })}
                          placeholder="Produce"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming || scanning}
                className="btn btn-accent"
              >
                {confirming ? "Adding…" : `Add ${rows.filter((r) => r.included).length} lines to stock`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRows(null);
                  setBusyStatus("");
                  setResult(null);
                }}
                className="btn btn-outline"
              >
                Scan another
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
