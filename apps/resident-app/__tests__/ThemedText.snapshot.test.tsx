/**
 * Snapshot + branch tests for ThemedText — all 6 variants, weight/color overrides.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { ThemedText } from '../src/components/ui/ThemedText';

describe('ThemedText', () => {
  it('default (body) variant snapshot', () => {
    expect(render(<ThemedText>Body text</ThemedText>).toJSON()).toMatchSnapshot();
  });

  it('heading variant snapshot', () => {
    expect(render(<ThemedText variant="heading">Heading</ThemedText>).toJSON()).toMatchSnapshot();
  });

  it('subheading variant snapshot', () => {
    expect(render(<ThemedText variant="subheading">Subheading</ThemedText>).toJSON()).toMatchSnapshot();
  });

  it('caption variant snapshot', () => {
    expect(render(<ThemedText variant="caption">Caption</ThemedText>).toJSON()).toMatchSnapshot();
  });

  it('label variant snapshot', () => {
    expect(render(<ThemedText variant="label">Label</ThemedText>).toJSON()).toMatchSnapshot();
  });

  it('muted variant snapshot', () => {
    expect(render(<ThemedText variant="muted">Muted</ThemedText>).toJSON()).toMatchSnapshot();
  });

  it('weight override applies fontWeight', () => {
    const tree = render(<ThemedText weight="bold">Bold</ThemedText>).toJSON() as any;
    const styles = Array.isArray(tree.props.style) ? tree.props.style : [tree.props.style];
    const combined = Object.assign({}, ...styles.filter(Boolean));
    expect(combined.fontWeight).toBe('700');
  });

  it('color override applies color', () => {
    const tree = render(<ThemedText color="#FF0000">Red</ThemedText>).toJSON() as any;
    const styles = Array.isArray(tree.props.style) ? tree.props.style : [tree.props.style];
    const combined = Object.assign({}, ...styles.filter(Boolean));
    expect(combined.color).toBe('#FF0000');
  });

  it('accessibilityRole is passed through', () => {
    const { getByRole } = render(<ThemedText accessibilityRole="header">Title</ThemedText>);
    expect(getByRole('header')).toBeTruthy();
  });

  it('renders without weight or color override (undefined branches)', () => {
    // Exercises the undefined checks in style array
    const tree = render(<ThemedText variant="body">No overrides</ThemedText>).toJSON();
    expect(tree).not.toBeNull();
  });
});
