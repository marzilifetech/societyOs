/**
 * Snapshot + a11y tests for StatusChip.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { StatusChip, StatusTone } from '../src/components/ui/StatusChip';

const TONES: StatusTone[] = [
  'neutral',
  'info',
  'pending',
  'progress',
  'success',
  'warning',
  'danger',
  'cancelled',
];

describe('StatusChip', () => {
  TONES.forEach((tone) => {
    it(`tone="${tone}" snapshot`, () => {
      const tree = render(<StatusChip label={tone.toUpperCase()} tone={tone} />).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  it('sm vs md size snapshots', () => {
    const sm = render(<StatusChip label="A" size="sm" />).toJSON();
    const md = render(<StatusChip label="A" size="md" />).toJSON();
    expect(sm).toMatchSnapshot('sm');
    expect(md).toMatchSnapshot('md');
  });

  it('renders icon when provided', () => {
    const tree = render(<StatusChip label="Dispatched" tone="success" icon="checkmark-circle" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('exposes accessible label as "Status: <label>"', () => {
    const { getByLabelText } = render(<StatusChip label="Pending" tone="pending" />);
    expect(getByLabelText('Status: Pending')).toBeTruthy();
  });
});
