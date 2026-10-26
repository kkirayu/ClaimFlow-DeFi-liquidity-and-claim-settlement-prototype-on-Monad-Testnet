import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import { InlineNotice } from '@/components/ui/Feedback';
import { AmountInput } from '@/components/data-display/AmountInput';
import { CopyButton } from '@/components/ui/CopyButton';
import { TransactionState } from '@/components/transactions/TransactionState';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import {
  emptyClaimForm,
  generateOpaqueHash,
  validateClaimForm,
  type ClaimFormErrors,
  type ClaimFormValues,
} from '@/lib/claimForm';
import { CATEGORY_OPTIONS, BRANCH_OPTIONS, branchLabel, categoryLabel } from '@/lib/labels';
import { formatToken, shortAddress } from '@/lib/format';
import { requireProtocol } from '@/lib/contracts';

export function NewClaimDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { run, isBusy } = useTransaction();
  const { manager } = requireProtocol();
  const [values, setValues] = useState<ClaimFormValues>(() => emptyClaimForm());
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(emptyClaimForm());
    setAttempted(false);
  }, [open]);

  const validation = useMemo(() => validateClaimForm(values), [values]);
  const errors: ClaimFormErrors = attempted ? validation.errors : {};

  const set = <Key extends keyof ClaimFormValues>(key: Key, value: ClaimFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!validation.parsed) return;
    const parsed = validation.parsed;

    const result = await run({
      label: 'Submit claim',
      request: {
        address: manager.address,
        abi: manager.abi,
        functionName: 'submitClaim',
        args: [
          parsed.claimId,
          parsed.claimRefHash,
          parsed.branchCode,
          parsed.categoryId,
          parsed.recipient,
          parsed.amount,
          parsed.evidenceHash,
        ],
      },
    });

    if (result) {
      setAttempted(false);
      onCreated?.();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New claim"
      description="Record minimal, opaque claim metadata. The contract stores every field publicly."
      size="lg"
      preventClose={isBusy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-claim-form"
            isLoading={isBusy}
            loadingLabel="Waiting for wallet…"
          >
            Submit claim
          </Button>
        </>
      }
    >
      <form
        id="new-claim-form"
        className="space-y-5"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <InlineNotice tone="warning" title="No personal data">
          All metadata is stored publicly on the blockchain. Do not enter names, identity numbers,
          policy numbers, health details, addresses, or any other personal data.
        </InlineNotice>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Claim reference hash"
            htmlFor="claim-ref"
            error={errors.claimRefHash}
            hint="32-byte opaque reference generated from non-PII data."
            required
          >
            <div className="flex gap-2">
              <Input
                id="claim-ref"
                value={values.claimRefHash}
                onChange={(event) => set('claimRefHash', event.target.value)}
                invalid={Boolean(errors.claimRefHash)}
                spellCheck={false}
                autoComplete="off"
                className="mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 shrink-0"
                onClick={() => set('claimRefHash', generateOpaqueHash())}
                title="Generate a new opaque reference"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Generate
              </Button>
            </div>
          </Field>

          <Field
            label="Evidence hash (optional)"
            htmlFor="claim-evidence"
            error={errors.evidenceHash}
          >
            <Input
              id="claim-evidence"
              value={values.evidenceHash}
              onChange={(event) => set('evidenceHash', event.target.value)}
              invalid={Boolean(errors.evidenceHash)}
              placeholder="0x… (optional)"
              spellCheck={false}
              autoComplete="off"
              className="mono"
            />
          </Field>

          <Field
            label="Branch code"
            htmlFor="claim-branch"
            error={errors.branchCode}
            hint="Numeric demo branch. Known labels: 101–105."
            required
          >
            <Input
              id="claim-branch"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.branchCode}
              onChange={(event) => set('branchCode', event.target.value)}
              invalid={Boolean(errors.branchCode)}
              list="claim-branch-options"
            />
            <datalist id="claim-branch-options">
              {BRANCH_OPTIONS.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </datalist>
          </Field>

          <Field label="Category" htmlFor="claim-category" error={errors.categoryId} required>
            <Select
              id="claim-category"
              value={values.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
              invalid={Boolean(errors.categoryId)}
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Recipient wallet"
            htmlFor="claim-recipient"
            error={errors.recipient}
            hint="Receives the payout after settlement. Verify carefully."
            required
          >
            <Input
              id="claim-recipient"
              value={values.recipient}
              onChange={(event) => set('recipient', event.target.value)}
              invalid={Boolean(errors.recipient)}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              className="mono"
            />
          </Field>

          <AmountInput
            id="claim-amount"
            label="Claim amount"
            value={values.amount}
            onChange={(value) => set('amount', value)}
            error={errors.amount}
            hint="Must be covered by available liquidity at approval time."
            required
          />
        </div>

        <div>
          <p className="text-ink-primary mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <ShieldAlert className="text-ink-muted h-4 w-4" aria-hidden="true" />
            Claim record preview
          </p>
          {validation.parsed ? (
            <div className="rounded-card border-border bg-surface-muted/40 border px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-muted">Claim ID (auto-generated)</span>
                <span className="inline-flex items-center gap-1">
                  <span className="mono max-w-[220px] truncate" title={validation.parsed.claimId}>
                    {validation.parsed.claimId}
                  </span>
                  <CopyButton value={validation.parsed.claimId} label="Copy claim ID" />
                </span>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Amount</dt>
                  <dd className="tabular text-ink-primary mt-0.5 text-sm font-semibold">
                    {formatToken(validation.parsed.amount)} mUSDC
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Recipient</dt>
                  <dd className="mono mt-0.5">{shortAddress(validation.parsed.recipient, 6)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Branch</dt>
                  <dd className="mt-0.5">{branchLabel(validation.parsed.branchCode)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Category</dt>
                  <dd className="mt-0.5">{categoryLabel(validation.parsed.categoryId)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="rounded-card border-border bg-surface-muted/30 text-ink-muted border border-dashed px-4 py-4 text-xs leading-5">
              Complete the required fields to preview the exact record that will be submitted.
            </p>
          )}
        </div>

        <TransactionState />
      </form>
    </Dialog>
  );
}
