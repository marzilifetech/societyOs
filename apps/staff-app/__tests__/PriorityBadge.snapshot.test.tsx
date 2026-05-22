import { render } from '@testing-library/react-native';
import React from 'react';
import { PriorityBadge } from '../src/components/task/PriorityBadge';

/** Helpers to build ISO timestamps relative to now */
const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

describe('PriorityBadge', () => {
  // ─── Null cases ────────────────────────────────────────────────────────────

  it('renders nothing for COMPLETED task', () => {
    expect(render(<PriorityBadge createdAt={hoursAgo(1)} status="COMPLETED" />).toJSON()).toBeNull();
  });

  it('renders nothing for REJECTED task', () => {
    expect(render(<PriorityBadge createdAt={hoursAgo(1)} status="REJECTED" />).toJSON()).toBeNull();
  });

  it('renders nothing when createdAt is undefined', () => {
    expect(render(<PriorityBadge status="OPEN" />).toJSON()).toBeNull();
  });

  it('renders nothing when task is well within SLA (< 75%)', () => {
    // 4 hours old with 24-hour SLA → 17% — no badge
    expect(render(<PriorityBadge createdAt={hoursAgo(4)} slaHours={24} status="OPEN" />).toJSON()).toBeNull();
  });

  // ─── SLA breach (> 100%) ──────────────────────────────────────────────────

  it('renders breached badge when age exceeds slaHours', () => {
    const tree = render(<PriorityBadge createdAt={hoursAgo(48)} slaHours={24} status="OPEN" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders breached badge immediately past the SLA boundary', () => {
    // 24.1 hours old with 24-hour SLA — just past
    const tree = render(<PriorityBadge createdAt={hoursAgo(24.1)} slaHours={24} status="OPEN" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  // ─── At-risk (75%–100%) ───────────────────────────────────────────────────

  it('renders at-risk badge at 83% of SLA (20 / 24 hours)', () => {
    const tree = render(<PriorityBadge createdAt={hoursAgo(20)} slaHours={24} status="OPEN" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders at-risk badge just above 75% threshold', () => {
    // 18.1 hours / 24 → 75.4% — at-risk
    const tree = render(<PriorityBadge createdAt={hoursAgo(18.1)} slaHours={24} status="OPEN" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders nothing at exactly 75% of SLA (boundary — not yet at-risk)', () => {
    // 18 hours / 24 = 75% exactly — ageHrs > slaHours * 0.75 is false when equal
    expect(render(<PriorityBadge createdAt={hoursAgo(18)} slaHours={24} status="OPEN" />).toJSON()).toBeNull();
  });

  // ─── Custom SLA ───────────────────────────────────────────────────────────

  it('respects a custom slaHours of 48', () => {
    // 40 hours old, 48-hour SLA → 83% → at-risk
    const tree = render(<PriorityBadge createdAt={hoursAgo(40)} slaHours={48} status="OPEN" />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
