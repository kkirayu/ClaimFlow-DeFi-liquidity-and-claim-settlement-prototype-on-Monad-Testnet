import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { AmountInput } from '@/components/data-display/AmountInput';
import { EmptyState } from './Feedback';

describe('Button', () => {
  it('sets loading and disabled state while a transaction is in flight', () => {
    render(
      <Button isLoading loadingLabel="Waiting for wallet…">
        Deposit
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Waiting for wallet/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('runs click handlers and supports the danger variant', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="danger" onClick={onClick}>
        Reject claim
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reject claim' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('AmountInput', () => {
  it('associates its label, suffix, max action, and error message', async () => {
    const onChange = vi.fn();
    const onMax = vi.fn();
    render(
      <AmountInput
        id="amount"
        label="Amount"
        value="12.5"
        onChange={onChange}
        onMax={onMax}
        maxLabel="Max"
        error="Amount exceeds your balance."
      />,
    );

    const input = screen.getByLabelText(/Amount/);
    expect(input).toHaveValue('12.5');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('mUSDC')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds your balance.');

    await userEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(onMax).toHaveBeenCalledOnce();
  });
});

describe('EmptyState', () => {
  it('renders a title, explanation, and optional action', () => {
    render(
      <EmptyState
        title="No claims yet"
        description="Claims appear here after an operator submits one."
        action={<button type="button">Submit claim</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No claims yet' })).toBeInTheDocument();
    expect(screen.getByText(/Claims appear here/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit claim' })).toBeInTheDocument();
  });
});
