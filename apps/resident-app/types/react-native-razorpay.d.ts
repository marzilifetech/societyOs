declare module 'react-native-razorpay' {
  export interface RazorpayCheckoutOptions {
    description?: string;
    image?: string;
    currency: string;
    amount: number | string;
    key: string;
    name: string;
    order_id?: string;
    prefill?: { contact?: string; email?: string; name?: string; method?: string };
    theme?: { color?: string };
    notes?: Record<string, string>;
    retry?: { enabled?: boolean; max_count?: number };
    [k: string]: unknown;
  }

  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    method?: string;
  }

  export interface RazorpayError {
    code: string | number;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  }

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpaySuccess>;
  };

  export default RazorpayCheckout;
}
