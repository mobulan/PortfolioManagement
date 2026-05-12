'use client';

import { RefreshCw, Trash2 } from 'lucide-react';

const transactionLabels = {
  buy: 'Buy',
  sell: 'Sell',
  convert_in: 'Convert in',
  convert_out: 'Convert out',
  dividend_cash: 'Cash dividend',
  dividend_reinvest: 'Reinvest dividend',
  cash_in: 'Cash in',
  cash_out: 'Cash out',
  fee: 'Fee',
  adjustment: 'Adjustment',
};

const principalLabels = {
  increase: 'Increase',
  decrease: 'Decrease',
  manual_adjustment: 'Manual',
};

const money = (value) => Number(value || 0).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = (value) => Number(value || 0).toLocaleString('zh-CN', {
  maximumFractionDigits: 6,
});

export default function PortfolioTransactionsPanel({
  portfolioId,
  holdings = [],
  transactions = [],
  principalRecords = [],
  onDeleteTransaction,
  onRebuildLedger,
  canMutateLedger = true,
}) {
  const scopedTransactions = transactions
    .filter((tx) => !portfolioId || tx.portfolioId === portfolioId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  const scopedPrincipalRecords = principalRecords
    .filter((record) => !portfolioId || record.portfolioId === portfolioId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  const holdingById = new Map(holdings.map((holding) => [holding.id, holding]));

  return (
    <section className="portfolio-panel glass">
      <div className="portfolio-panel-header">
        <h3>Transactions and principal</h3>
        <button type="button" className="button secondary" onClick={() => onRebuildLedger?.()} disabled={!canMutateLedger}>
          <RefreshCw size={16} />
          Rebuild
        </button>
      </div>

      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Asset</th>
              <th>Amount</th>
              <th>Share</th>
              <th>Fee</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {scopedTransactions.length ? scopedTransactions.map((tx) => {
              const holding = holdingById.get(tx.holdingId);
              return (
                <tr key={tx.id}>
                  <td>{tx.date || '-'}</td>
                  <td>{transactionLabels[tx.type] || tx.type}</td>
                  <td>{holding?.fundName || tx.fundCode || tx.holdingId || '-'}</td>
                  <td>{money(tx.amount)}</td>
                  <td>{number(tx.share)}</td>
                  <td>{money(tx.fee)}</td>
                  <td>
                    <button
                      type="button"
                      className="button ghost"
                      onClick={() => onDeleteTransaction?.(tx)}
                      disabled={!canMutateLedger}
                      title="Delete transaction"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7}>No transactions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Asset</th>
              <th>Principal delta</th>
              <th>Before</th>
              <th>After</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {scopedPrincipalRecords.length ? scopedPrincipalRecords.map((record) => {
              const holding = holdingById.get(record.holdingId);
              return (
                <tr key={record.id}>
                  <td>{record.date || '-'}</td>
                  <td>{principalLabels[record.type] || record.type}</td>
                  <td>{holding?.fundName || record.holdingId || '-'}</td>
                  <td>{money(record.amount)}</td>
                  <td>{money(record.beforePrincipal)}</td>
                  <td>{money(record.afterPrincipal)}</td>
                  <td>{record.transactionId || '-'}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7}>No principal records yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
