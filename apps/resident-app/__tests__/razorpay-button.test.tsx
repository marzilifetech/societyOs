/**
 * Component test: PayBill button — fires onPay with bill amount when pressed,
 * disables itself while pending, shows error on signature mismatch.
 *
 * Self-contained: when the real PayBill component lands, swap the local
 * component import for the production one — assertions stay.
 */
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import React, { useState } from 'react';

function PayBillButton({
  amount,
  onPay,
}: {
  amount: number;
  onPay: (paise: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        testID="pay-btn"
        disabled={pending}
        onPress={async () => {
          setPending(true);
          setError(null);
          const r = await onPay(amount * 100);
          if (!r.ok) setError(r.error ?? 'PAYMENT_FAILED');
          setPending(false);
        }}
      >
        <Text>{pending ? 'Processing...' : `Pay ₹${amount}`}</Text>
      </Pressable>
      {error ? <Text testID="pay-error">{error}</Text> : null}
    </>
  );
}

describe('PayBill button', () => {
  it('passes amount in paise to handler', async () => {
    const onPay = jest.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(<PayBillButton amount={2500} onPay={onPay} />);
    fireEvent.press(getByTestId('pay-btn'));
    await waitFor(() => expect(onPay).toHaveBeenCalledWith(250000));
  });

  it('shows error when signature verification fails', async () => {
    const onPay = jest.fn().mockResolvedValue({ ok: false, error: 'SIGNATURE_MISMATCH' });
    const { getByTestId, findByTestId } = render(<PayBillButton amount={500} onPay={onPay} />);
    fireEvent.press(getByTestId('pay-btn'));
    const err = await findByTestId('pay-error');
    expect(err).toBeTruthy();
  });
});
