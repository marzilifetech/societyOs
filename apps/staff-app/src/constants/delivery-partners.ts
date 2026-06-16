/**
 * Canonical India delivery partners shown to staff in the Add Entry form.
 *
 * Must stay in sync with the server-side validator at
 * backend/src/modules/visitor/visitor.service.ts -> DELIVERY_PARTNERS.
 * Sending a value not in this list (and not prefixed with "Other: ") makes
 * the backend reject the request with DELIVERY_PARTNER_INVALID.
 *
 * To add a new courier: append here AND update the backend constant in
 * the same PR. Anything else stays under the "Other" free-text fallback.
 */
export const DELIVERY_PARTNERS = [
  'Amazon',
  'Flipkart',
  'Swiggy',
  'Swiggy Instamart',
  'Zomato',
  'Blinkit',
  'Zepto',
  'BigBasket',
  'Dunzo',
  'Meesho',
  'BlueDart',
  'Delhivery',
  'DTDC',
  'Shadowfax',
  'Ecom Express',
  'Xpressbees',
  'India Post',
  'FedEx',
] as const;

export type DeliveryPartner = (typeof DELIVERY_PARTNERS)[number];
