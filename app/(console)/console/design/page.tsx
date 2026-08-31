"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RestaurantSettings } from "@/types/customization";

interface CustomizationRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'pending_review' | 'failed';
  requested_changes: Partial<RestaurantSettings>;
  proposed_settings: RestaurantSettings;
  user_request_text: string | null;
  description: string | null;
  preview_html: string | null;
  created_at: string;
}

export default function DesignPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<CustomizationRequest[]>([]);
  const [currentSettings, setCurrentSettings] = useState<RestaurantSettings>({});
  const [loading, setLoading] = useState(true);
  const [requestText, setRequestText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [stateRes, reqsRes] = await Promise.all([
        fetch("/api/customizations/state"),
        fetch("/api/customizations/requests")
      ]);
      const stateData = await stateRes.json();
      const reqsData = await reqsRes.json();
      setCurrentSettings(stateData.settings || {});
      setRequests(reqsData.requests || []);
    } catch (e) {
      console.error("Failed to load design data", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestChange() {
    if (!requestText.trim()) return;
    setIsSubmitting(true);
    try {
      // Parse the user's request via the parser route (lightweight keyword parse)
      const parseRes = await fetch("/api/customizations/parse-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequestText: requestText,
          currentSettings
        })
      });
      if (!parseRes.ok) {
        console.error("Parse failed");
        return;
      }
      const { description, settingsDelta } = await parseRes.json();

      // Create the request record
      const res = await fetch("/api/customizations/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_request_text: requestText,
          requested_changes: settingsDelta,
          description: description
        })
      });

      if (!res.ok) {
        console.error("Request create failed", res.status);
        return;
      }

      const { request } = await res.json();

      // Kick off Kiro-frontend generation for this request
      if (request?.id) {
        await fetch("/api/customizations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: request.id })
        });
      }

      setRequestText("");
      await loadData();
    } catch (e) {
      console.error("Request failed", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function approveRequest(requestId: string) {
    try {
      const res = await fetch("/api/customizations/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
      });
      
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error("Approval failed", e);
    }
  }

  async function rejectRequest(requestId: string) {
    try {
      const res = await fetch("/api/customizations/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
      });
      
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error("Rejection failed", e);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-black rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading design settings...</p>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const inProgressRequests = requests.filter(r => r.status === 'processing' || r.status === 'pending_review');
  const pastRequests = requests.filter(r => !['pending', 'processing', 'pending_review'].includes(r.status));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      {/* Request Form */}
      <section>
        <h1 className="text-3xl font-display mb-2">Website Customization</h1>
        <p className="text-muted-foreground mb-6">
          Describe the layout or style changes you want for your restaurant's website.
        </p>
        
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <label className="block text-sm font-medium mb-2">
            What would you like to change?
          </label>
          <textarea
            className="w-full p-3 border rounded-md bg-gray-50 text-gray-900 min-h-[100px] resize-none"
            placeholder={"Examples:\n• Move the menu to the left sidebar\n• Change the theme to deep ocean blue\n• Make the booking form a popup modal\n• Dark luxury theme with gold accents"}
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
          />
          <div className="mt-4 flex justify-end">
            <button
              className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleRequestChange}
              disabled={isSubmitting || !requestText.trim()}
            >
              {isSubmitting ? "Submitting..." : "Request Change"}
            </button>
          </div>
        </div>
      </section>

      {/* Pending Proposals */}
      <section>
        <h2 className="text-xl font-bold mb-4">
          Pending Proposals
          {pendingRequests.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({pendingRequests.length} awaiting review)
            </span>
          )}
        </h2>
        
        {pendingRequests.length === 0 ? (
          <div className="bg-gray-50 border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">No pending changes to review.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Submit a request above to generate a proposal.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div key={req.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                {/* Description */}
                <div className="p-6 border-b bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                        Proposed Change
                      </span>
                      <p className="mt-1 text-lg font-medium text-gray-900">
                        {req.description || "Processing your request..."}
                      </p>
                      {req.user_request_text && req.description && (
                        <p className="mt-1 text-sm text-muted-foreground italic">
                          You requested: "{req.user_request_text}"
                        </p>
                      )}
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium">
                      Awaiting Approval
                    </span>
                  </div>
                </div>
                
                {/* Preview */}
                <div className="p-6">
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => setPreviewOpen(previewOpen === req.id ? null : req.id)}
                      className="text-sm border px-4 py-2 rounded hover:bg-gray-50 transition-colors text-black"
                    >
                      {previewOpen === req.id ? "Hide Preview" : "Show Preview"}
                    </button>
                    <a
                      href={`/api/customizations/preview/${req.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm border px-4 py-2 rounded hover:bg-gray-50 transition-colors text-black"
                    >
                      Open Full Preview
                    </a>
                  </div>
                  
                  {previewOpen === req.id && (
                    <div className="border rounded overflow-hidden bg-gray-100">
                      <iframe
                        srcDoc={req.preview_html || generateDefaultPreview(req.proposed_settings)}
                        className="w-full h-[400px] bg-white"
                        title="Layout Preview"
                      />
                    </div>
                  )}
                  
                  {/* What Changes */}
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded text-sm">
                    <strong className="text-blue-900">What will change:</strong>
                    <ul className="mt-2 space-y-1 text-blue-800">
                      {Object.entries(req.requested_changes).map(([key, value]) => (
                        <li key={key}>• {formatChange(key, value)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="px-4 py-2 border rounded hover:bg-white transition-colors text-sm text-black"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={() => approveRequest(req.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Approve & Deploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* In Progress (being generated / awaiting internal review) */}
      {inProgressRequests.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">In Progress</h2>
          <div className="space-y-3">
            {inProgressRequests.map((req) => (
              <div key={req.id} className="border rounded-lg bg-white shadow-sm p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {req.user_request_text || "Customization request"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {req.status === 'processing'
                      ? "Our design team is generating your preview. This usually takes a moment."
                      : "Your preview is being quality-checked before it reaches you."}
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded font-medium bg-amber-100 text-amber-800 whitespace-nowrap">
                  {req.status === 'processing' ? 'Generating…' : 'Finalizing…'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Current Settings */}
      <section>
        <h2 className="text-xl font-bold mb-4">Current Live Settings</h2>
        <div className="bg-gray-50 border rounded-lg p-4">
          <pre className="text-xs overflow-auto font-mono text-gray-700">
            {JSON.stringify(currentSettings, null, 2)}
          </pre>
        </div>
      </section>

      {/* History */}
      {pastRequests.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Recent History</h2>
          <div className="space-y-2">
            {pastRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm">
                <span className="text-muted-foreground">
                  {req.description || req.user_request_text || "Custom change"}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatChange(key: string, value: unknown): string {
  const labels: Record<string, string> = {
    menuPosition: 'Menu position',
    cartPosition: 'Cart position', 
    bookingPosition: 'Booking form position',
    primaryColor: 'Primary color',
    accentColor: 'Accent color',
    fontFamily: 'Font',
    customCss: 'Custom CSS',
    theme: 'Theme',
  };
  
  return `${labels[key] || key} → ${value}`;
}

function generateDefaultPreview(settings: RestaurantSettings): string {
  const { menuPosition = 'right', primaryColor = '#1f2937' } = settings;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { --primary: ${primaryColor}; }
  </style>
</head>
<body class="bg-gray-100">
  <div class="min-h-screen p-4">
    <div class="bg-blue-600 text-white p-2 text-center text-xs font-medium mb-4">
      PREVIEW MODE
    </div>
    <div class="bg-white rounded shadow p-6">
      <h2 class="font-bold mb-2">Proposed Layout</h2>
      <p class="text-sm text-gray-600">Menu: ${menuPosition}</p>
      <p class="text-sm text-gray-600">Primary: ${primaryColor}</p>
    </div>
  </div>
</body>
</html>
  `;
}
