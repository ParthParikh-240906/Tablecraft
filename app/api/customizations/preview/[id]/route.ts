import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  
  const { data: req } = await supabase
    .from("customization_requests")
    .select("*")
    .eq("id", id)
    .single();
  
  if (!req) {
    return new NextResponse("Request not found", { status: 404 });
  }
  
  // Generate preview HTML
  const settings = req.proposed_settings || {};
  const previewHtml = generatePreviewHtml(settings, req.preview_html);
  
  return new NextResponse(previewHtml, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

function generatePreviewHtml(settings: Record<string, unknown>, customHtml?: string | null): string {
  if (customHtml) return customHtml;
  
  const menuPosition = (settings.menuPosition as string) || 'right';
  const cartPosition = (settings.cartPosition as string) || 'top-right';
  const bookingPosition = (settings.bookingPosition as string) || 'inline';
  const primaryColor = (settings.primaryColor as string) || '#1f2937';
  
  const menuClasses: Record<string, string> = {
    'left': 'fixed left-0 top-0 h-screen w-72 bg-white shadow-xl',
    'right': 'fixed right-0 top-0 h-screen w-72 bg-white shadow-xl',
    'top': 'w-full bg-white shadow-md border-b',
  };
  
  const cartClasses: Record<string, string> = {
    'top-right': 'fixed top-4 right-4 bg-white shadow-lg rounded-lg p-3',
    'bottom-right': 'fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-3',
  };
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Layout Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --primary: ${primaryColor};
      --primary-light: color-mix(in srgb, ${primaryColor} 90%, white);
    }
    .bg-primary { background-color: var(--primary); }
    .text-primary { color: var(--primary); }
    .border-primary { border-color: var(--primary); }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Preview Banner -->
  <div class="bg-blue-600 text-white py-3 px-4 text-center text-sm font-medium sticky top-0 z-50">
    🎨 PREVIEW MODE — This shows how your website will look after approval
  </div>
  
  <!-- Menu -->
  <aside class="${menuClasses[menuPosition] || menuClasses['right']} z-40">
    <div class="p-4 border-b">
      <h2 class="font-bold text-lg text-primary">Menu</h2>
    </div>
    <div class="p-4 space-y-3 overflow-auto ${menuPosition === 'top' ? 'flex gap-4' : ''}">
      <div class="p-3 bg-gray-50 rounded border hover:shadow-sm transition-shadow cursor-pointer">
        <div class="font-medium">Signature Dish</div>
        <div class="text-sm text-gray-500">$24.99</div>
      </div>
      <div class="p-3 bg-gray-50 rounded border hover:shadow-sm transition-shadow cursor-pointer">
        <div class="font-medium">Chef's Special</div>
        <div class="text-sm text-gray-500">$32.00</div>
      </div>
      <div class="p-3 bg-gray-50 rounded border hover:shadow-sm transition-shadow cursor-pointer">
        <div class="font-medium">Seasonal Item</div>
        <div class="text-sm text-gray-500">$18.50</div>
      </div>
    </div>
  </aside>
  
  <!-- Main Content -->
  <main class="${menuPosition === 'left' ? 'ml-72' : menuPosition === 'right' ? 'mr-72' : ''} p-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-4xl font-display font-bold text-primary mb-2">Your Restaurant</h1>
        <p class="text-gray-600">Authentic cuisine served with passion</p>
      </header>
      
      <!-- Booking Section -->
      <section class="mb-8 ${bookingPosition === 'modal' ? 'hidden' : ''}">
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <h3 class="font-semibold text-lg text-green-900 mb-2">📅 Book a Table</h3>
          <p class="text-sm text-green-700 mb-4">Reserve your spot for an unforgettable dining experience</p>
          <div class="flex gap-3">
            <input type="date" class="px-3 py-2 border rounded text-sm" />
            <select class="px-3 py-2 border rounded text-sm">
              <option>7:00 PM</option>
              <option>8:00 PM</option>
              <option>9:00 PM</option>
            </select>
            <button class="px-4 py-2 bg-primary text-white rounded text-sm font-medium">Reserve</button>
          </div>
        </div>
      </section>
      
      ${bookingPosition === 'modal' ? `
      <!-- Booking Button (for modal mode) -->
      <button class="mb-8 px-6 py-3 bg-primary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-shadow">
        📅 Book a Table
      </button>
      ` : ''}
      
      <!-- Sample Content -->
      <section class="bg-white rounded-lg shadow-sm p-6">
        <h2 class="font-semibold text-lg mb-4">About Us</h2>
        <p class="text-gray-600 leading-relaxed">
          Welcome to our restaurant. This preview shows how your layout will appear 
          with the proposed changes. The menu is positioned ${menuPosition}, the cart 
          is in the ${cartPosition}, and booking is ${bookingPosition === 'modal' ? 'a popup modal' : 'inline'}.
        </p>
      </section>
    </div>
  </main>
  
  <!-- Cart -->
  <div class="${cartClasses[cartPosition] || cartClasses['top-right']} z-50">
    <div class="flex items-center gap-2">
      <span class="text-2xl">🛒</span>
      <div>
        <div class="font-medium text-sm">Cart</div>
        <div class="text-xs text-gray-500">3 items · $75.49</div>
      </div>
    </div>
  </div>
  
  <!-- Legend -->
  <div class="fixed bottom-4 left-4 bg-white shadow-lg rounded-lg p-4 text-xs max-w-xs z-50">
    <div class="font-semibold mb-2 text-gray-700">Layout Legend</div>
    <div class="space-y-1 text-gray-600">
      <div>• Menu: <strong>${menuPosition}</strong></div>
      <div>• Cart: <strong>${cartPosition}</strong></div>
      <div>• Booking: <strong>${bookingPosition}</strong></div>
      <div>• Primary Color: <strong style="color:${primaryColor}">${primaryColor}</strong></div>
    </div>
  </div>
</body>
</html>
  `;
}
