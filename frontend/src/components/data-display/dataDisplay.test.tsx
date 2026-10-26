import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { LiquidityBreakdown } from './LiquidityBreakdown';
import { RoleBadges } from './RoleBadges';
import { ClaimStatus } from '@/lib/claims';
import type { RolesState } from '@/lib/roles';

describe('StatusBadge', () => {
  it('renders an explicit label and status meaning, not colour alone', () => {
    render(<StatusBadge status={ClaimStatus.ApprovedReserved} />);
    expect(screen.getByText('Approved & Reserved')).toBeInTheDocument();
    expect(screen.getByTitle(/Approved with liquidity reserved/)).toBeInTheDocument();
  });

  it('supports a compact label for dense tables', () => {
    render(<StatusBadge status={ClaimStatus.ApprovedReserved} compact />);
    expect(screen.getByText('Reserved')).toBeInTheDocument();
  });
});

describe('LiquidityBreakdown', () => {
  it('shows available, reserved, and an accessible composition summary', () => {
    render(
      <MemoryRouter>
        <LiquidityBreakdown balance={100_000_000n} available={75_000_000n} reserved={25_000_000n} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Vault composition')).toBeInTheDocument();
    expect(screen.getByText('75.00 mUSDC')).toBeInTheDocument();
    expect(screen.getByText('25.00 mUSDC')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Vault balance 100\.00 mUSDC: available 75\.00, reserved 25\.00\./,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('does not divide by zero for an empty vault', () => {
    render(<LiquidityBreakdown balance={0n} available={0n} reserved={0n} />);
    expect(screen.getAllByText('0.00 mUSDC')).toHaveLength(2);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});

const ROLES: RolesState = {
  isOperator: true,
  isApprover: false,
  isSettler: false,
  isCanceller: false,
  isAdmin: false,
  isConnected: true,
};

describe('RoleBadges', () => {
  it('lists every role with granted and not-granted text alternatives', () => {
    render(<RoleBadges roles={ROLES} showDescription />);
    expect(screen.getByText('Claim Operator')).toBeInTheDocument();
    expect(screen.getByText('Claim Approver')).toBeInTheDocument();
    expect(screen.getAllByText('granted')).toHaveLength(1);
    expect(screen.getAllByText('not granted')).toHaveLength(4);
    expect(
      screen.getByTitle('Approve with an atomic liquidity reservation, or reject pending claims.'),
    ).toBeInTheDocument();
  });
});
