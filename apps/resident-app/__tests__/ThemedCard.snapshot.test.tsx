/**
 * Snapshot + branch tests for ThemedCard.
 */

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { ThemedCard } from '../src/components/ui/ThemedCard';

describe('ThemedCard', () => {
  it('renders children (default card)', () => {
    const tree = render(<ThemedCard><Text>Hello</Text></ThemedCard>).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('strong prop uses stronger background', () => {
    const tree = render(<ThemedCard strong><Text>Strong</Text></ThemedCard>).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('glow="primary" adds primary shadow', () => {
    const tree = render(<ThemedCard glow="primary"><Text>Glow</Text></ThemedCard>).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('glow="emergency" adds emergency shadow', () => {
    const tree = render(<ThemedCard glow="emergency"><Text>Alert</Text></ThemedCard>).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('no glow keeps the soft neutral drop shadow, not a coloured glow', () => {
    const { toJSON } = render(<ThemedCard><Text>No glow</Text></ThemedCard>);
    const tree = toJSON() as any;
    const style = Array.isArray(tree.props.style) ? Object.assign({}, ...tree.props.style) : tree.props.style;
    expect(style.shadowColor).toBe('#000');
    expect(style.shadowOpacity).toBeLessThan(0.2);
  });
});
