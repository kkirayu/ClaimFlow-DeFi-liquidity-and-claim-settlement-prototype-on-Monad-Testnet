import { describe, expect, it } from 'vitest';
import { serializeCsv, type CsvColumn } from './csv';

interface Row {
  name: string;
  note?: string;
  amount: bigint;
}

const columns: CsvColumn<Row>[] = [
  { header: 'name', value: (row) => row.name },
  { header: 'note', value: (row) => row.note },
  { header: 'amount', value: (row) => row.amount },
];

describe('serializeCsv', () => {
  it('writes headers and rows in order', () => {
    const csv = serializeCsv([{ name: 'alpha', note: 'ok', amount: 1n }], columns);
    expect(csv).toBe('name,note,amount\nalpha,ok,1');
  });

  it('escapes commas, quotes, and newlines using CSV rules', () => {
    const csv = serializeCsv(
      [{ name: 'A, B', note: 'He said "hi"\nnext line', amount: 2n }],
      columns,
    );
    expect(csv).toBe('name,note,amount\n"A, B","He said ""hi""\nnext line",2');
  });

  it('renders missing values as empty cells', () => {
    const csv = serializeCsv([{ name: 'alpha', amount: 0n }], columns);
    expect(csv).toBe('name,note,amount\nalpha,,0');
  });

  it('returns only the header for an empty data set', () => {
    expect(serializeCsv([], columns)).toBe('name,note,amount');
  });
});
