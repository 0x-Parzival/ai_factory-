import "server-only";

export type RevenueSource = { id: "razorpay" | "paypal" | "crypto"; label: string; amount: number; currency: "USD"; connected: boolean; detail: string };
type PaypalTransaction = { transaction_info?: { transaction_event_code?: string; transaction_amount?: { value?: string; currency_code?: string } } };
type PaypalTransactionsResponse = { transaction_details?: PaypalTransaction[] };

const toUsd = (amount: unknown, currency: unknown) => String(currency || "USD").toUpperCase() === "USD" ? Number(amount || 0) : 0;

async function razorpayRevenue(): Promise<RevenueSource> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return { id: "razorpay", label: "Razorpay", amount: 0, currency: "USD", connected: false, detail: "Connect Razorpay to see verified earnings." };
  try {
    const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/payments?count=100", { headers: { authorization: `Basic ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Razorpay HTTP ${response.status}`);
    const payload = await response.json() as { items?: Array<{ status?: string; amount?: number; currency?: string }> };
    const amount = (payload.items || []).filter((payment) => payment.status === "captured").reduce((sum, payment) => sum + toUsd(Number(payment.amount || 0) / 100, payment.currency), 0);
    return { id: "razorpay", label: "Razorpay", amount, currency: "USD", connected: true, detail: "Captured USD payments in the latest available page." };
  } catch (error) { return { id: "razorpay", label: "Razorpay", amount: 0, currency: "USD", connected: false, detail: error instanceof Error ? error.message : "Razorpay could not be read." }; }
}

async function paypalRevenue(): Promise<RevenueSource> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) return { id: "paypal", label: "PayPal", amount: 0, currency: "USD", connected: false, detail: "Connect PayPal to see verified earnings." };
  try {
    const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const base = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) throw new Error("PayPal authentication failed.");
    const end = new Date().toISOString(); const start = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const response = await fetch(`${base}/v1/reporting/transactions?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&page_size=100`, { headers: { authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`PayPal HTTP ${response.status}`);
    const payload = await response.json() as PaypalTransactionsResponse;
    const amount = (payload.transaction_details || []).filter((item) => item.transaction_info?.transaction_event_code?.startsWith("T00")).reduce((sum, item) => sum + toUsd(item.transaction_info?.transaction_amount?.value, item.transaction_info?.transaction_amount?.currency_code), 0);
    return { id: "paypal", label: "PayPal", amount, currency: "USD", connected: true, detail: "Completed USD transactions over the last 30 days." };
  } catch (error) { return { id: "paypal", label: "PayPal", amount: 0, currency: "USD", connected: false, detail: error instanceof Error ? error.message : "PayPal could not be read." }; }
}

async function cryptoRevenue(): Promise<RevenueSource> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) return { id: "crypto", label: "Crypto", amount: 0, currency: "USD", connected: false, detail: "Connect Coinbase Commerce to see verified earnings." };
  try {
    const response = await fetch("https://api.commerce.coinbase.com/charges?limit=100", { headers: { "X-CC-Api-Key": apiKey, "X-CC-Version": "2018-03-22" }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Crypto gateway HTTP ${response.status}`);
    const payload = await response.json() as { data?: Array<{ timeline?: Array<{ status?: string }>; pricing?: { local?: { amount?: string; currency?: string } } }> };
    const amount = (payload.data || []).filter((charge) => charge.timeline?.some((event) => event.status === "COMPLETED")).reduce((sum, charge) => sum + toUsd(charge.pricing?.local?.amount, charge.pricing?.local?.currency), 0);
    return { id: "crypto", label: "Crypto", amount, currency: "USD", connected: true, detail: "Completed USD Coinbase Commerce charges in the latest available page." };
  } catch (error) { return { id: "crypto", label: "Crypto", amount: 0, currency: "USD", connected: false, detail: error instanceof Error ? error.message : "Crypto gateway could not be read." }; }
}

export async function getRevenueSnapshot() { return Promise.all([razorpayRevenue(), paypalRevenue(), cryptoRevenue()]); }
