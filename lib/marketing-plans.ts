/**
 * Marketing pricing plans — shared between the marketing page (`/`) and the
 * post-sign-in dashboard so both always show identical content.
 */

export type MarketingPlan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaLink: string;
  planKey: "pro" | "max" | null;
  features: string[];
  highlighted: boolean;
};

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    name: "Free",
    price: "0",
    period: "No credit card required",
    description: "Demo website + demo console. Perfect for planning and testing your restaurant.",
    cta: "Start free",
    ctaLink: "/signup",
    planKey: null,
    features: [
      "Mock public website",
      "Mock console access",
      "AI chatbot for bookings",
      "10 AI menu scanner requests / month",
      "5 AI image generations / month",
      "AI website content generator",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "1,500",
    period: "AED + 350 AED/month recurring",
    description: "Real hosted website + console. Everything you need to get your restaurant online.",
    cta: "Go Pro",
    ctaLink: "/signup?plan=pro",
    planKey: "pro",
    features: [
      "Real hosted website",
      "Real console access",
      "AI chatbot for bookings",
      "AI website content generator",
      "15 AI menu scanner requests / month",
      "10 AI image generations / month",
      "No meetings with senior frontend developer",
    ],
    highlighted: true,
  },
  {
    name: "Max",
    price: "3,500",
    period: "AED + 500 AED/month recurring",
    description: "Higher limits plus dedicated senior frontend support for ongoing changes.",
    cta: "Go Max",
    ctaLink: "/signup?plan=max",
    planKey: "max",
    features: [
      "Real hosted website",
      "Real console access",
      "AI chatbot for bookings",
      "AI website content generator",
      "40 AI menu scanner requests / month",
      "25 AI image generations / month",
      "3 × 30 min meetings with senior frontend developer / month",
    ],
    highlighted: false,
  },
];