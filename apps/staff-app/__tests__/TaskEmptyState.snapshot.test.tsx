import { render } from '@testing-library/react-native';
import React from 'react';
import { TaskEmptyState } from '../src/components/task/TaskEmptyState';

describe('TaskEmptyState', () => {
  it('renders default empty state', () => {
    const tree = render(<TaskEmptyState />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
