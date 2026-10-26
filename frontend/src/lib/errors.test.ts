import { describe, expect, it } from 'vitest';
import { describeError, readErrorMessage } from './errors';

describe('describeError', () => {
  it('classifies rejected wallet requests', () => {
    const result = describeError(new Error('User rejected the request.'));
    expect(result.kind).toBe('rejected');
    expect(result.title).toBe('Transaction rejected');
    expect(result.message).toContain('Nothing was sent on-chain');
  });

  it('classifies missing gas funds', () => {
    const result = describeError(new Error('insufficient funds for gas * price + value'));
    expect(result.kind).toBe('wallet-required');
    expect(result.title).toContain('testnet gas');
  });

  it('classifies a wrong chain', () => {
    const result = describeError(
      new Error(
        'The current chain of the wallet does not match the target chain for the transaction',
      ),
    );
    expect(result.kind).toBe('wrong-network');
  });

  it('classifies RPC timeouts', () => {
    const result = describeError(new Error('request timed out after 30000ms'));
    expect(result.kind).toBe('rpc');
    expect(result.title).toBe('RPC request failed');
  });

  it('classifies a missing contract as a configuration problem', () => {
    const result = describeError(new Error('returned no data ("0x")'));
    expect(result.kind).toBe('configuration');
  });

  it('falls back to a safe unknown message without inventing success', () => {
    const result = describeError(new Error('something unexpected'));
    expect(result.kind).toBe('unknown');
    expect(result.message).toContain('Check the claim status');
    expect(result.details).toBe('something unexpected');
  });
});

describe('readErrorMessage', () => {
  it('does not describe a failed read as zero data', () => {
    const result = readErrorMessage(new Error('unexpected read failure'));
    expect(result.title).toBe('Could not load on-chain data');
    expect(result.message).toContain('not shown as zero');
  });

  it('uses read-specific wording for a rejected RPC read', () => {
    const result = readErrorMessage(new Error('User rejected the request.'));
    expect(result.kind).toBe('rejected');
    expect(result.title).toBe('RPC read failed');
  });
});
