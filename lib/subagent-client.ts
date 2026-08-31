/**
 * Client for invoking the Kiro-frontend subagent.
 * 
 * This calls the Hermes delegate_task API to spawn a subagent
 * that generates layout/style changes for restaurant customization.
 */

import type { RestaurantSettings } from '@/types/customization';

export interface SubagentRequest {
  orgSlug: string;
  orgId: string;
  currentSettings: RestaurantSettings;
  requestedChanges: Partial<RestaurantSettings>;
  userRequestText: string;
}

export interface SubagentResponse {
  description: string;
  previewHtml: string;
  codeChanges: Array<{
    file: string;
    patch: string;
  }>;
  settingsDelta: Partial<RestaurantSettings>;
}

/**
 * Invoke the Kiro-frontend subagent to generate layout changes.
 * 
 * NOTE: This is designed to be called from an API route, NOT from client code.
 * The subagent runs in isolation and returns structured output.
 */
export async function invokeLayoutSubagent(request: SubagentRequest): Promise<SubagentResponse> {
  // In production, this would call Hermes's delegate_task tool
  // For now, we'll use a local AI endpoint or mock
  
  const prompt = buildSubagentPrompt(request);
  
  // This endpoint will be called by the Hermes agent itself when
  // it detects a pending customization request
  // The actual subagent invocation happens via delegate_task tool
  
  return {
    description: "This is a placeholder that will be replaced by actual subagent output",
    previewHtml: "",
    codeChanges: [],
    settingsDelta: request.requestedChanges,
  };
}

function buildSubagentPrompt(request: SubagentRequest): string {
  return `
You are generating a layout/style change for a restaurant website.

## Restaurant
- Slug: ${request.orgSlug}
- ID: ${request.orgId}

## Current Settings
${JSON.stringify(request.currentSettings, null, 2)}

## Requested Changes
User request: "${request.userRequestText}"
Parsed changes: ${JSON.stringify(request.requestedChanges, null, 2)}

## CRITICAL SAFETY REQUIREMENTS
1. Menu component MUST remain visible and functional
2. Cart component MUST remain visible and functional  
3. Booking ("Book a Table") component MUST remain visible and functional
4. You may reposition or restyle these elements, but NEVER remove them
5. If the requested change would break any of these, refuse and explain why

## Your Output
Return JSON with:
1. "description" — Plain-language explanation for a non-technical restaurant owner
2. "previewHtml" — HTML preview of the proposed layout (using Tailwind classes)
3. "codeChanges" — Array of {file, patch} objects for actual codebase edits
4. "settingsDelta" — The final settings object to merge

Focus on the layout files in app/(public)/[orgSlug]/.
`;
}

/**
 * Generate a preview HTML for the proposed layout change.
 * This is called by the subagent to create a visual representation.
 */
export function generatePreviewHtml(
  settings: RestaurantSettings,
  orgSlug: string
): string {
  const { menuPosition = 'right', cartPosition = 'top-right', bookingPosition = 'inline' } = settings;
  
  // Map positions to Tailwind classes
  const menuPositionMap: Record<string, string> = {
    'left': 'fixed left-0 top-0 h-screen w-64',
    'right': 'fixed right-0 top-0 h-screen w-64',
    'top': 'w-full border-b',
  };
  const menuClasses = menuPositionMap[menuPosition] || 'fixed right-0 top-0 h-screen w-64';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="min-h-screen">
    <!-- Preview Header -->
    <div class="bg-blue-600 text-white p-4 text-center text-sm font-medium">
      PREVIEW MODE — This is what your site will look like
    </div>
    
    <!-- Menu (${menuPosition}) -->
    <div class="${menuClasses} bg-white shadow-lg p-4">
      <h2 class="font-bold text-lg mb-4">Menu</h2>
      <div class="space-y-2 text-sm">
        <div class="p-2 bg-gray-50 rounded">Menu Item 1</div>
        <div class="p-2 bg-gray-50 rounded">Menu Item 2</div>
        <div class="p-2 bg-gray-50 rounded">Menu Item 3</div>
      </div>
    </div>
    
    <!-- Main Content -->
    <div class="p-8 ${menuPosition === 'left' ? 'ml-64' : menuPosition === 'right' ? 'mr-64' : ''}">
      <h1 class="text-3xl font-bold mb-4">${orgSlug} Restaurant</h1>
      
      <!-- Booking (${bookingPosition}) -->
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded">
        <h3 class="font-semibold">Book a Table</h3>
        <p class="text-sm text-gray-600">Reservation form will appear here</p>
      </div>
    </div>
    
    <!-- Cart (${cartPosition}) -->
    <div class="fixed ${cartPosition === 'bottom-right' ? 'bottom-4 right-4' : 'top-4 right-4'} bg-white shadow-lg p-4 rounded-lg">
      <span class="text-2xl">🛒</span>
      <span class="ml-2 font-medium">Cart (0)</span>
    </div>
  </div>
</body>
</html>
  `;
}
