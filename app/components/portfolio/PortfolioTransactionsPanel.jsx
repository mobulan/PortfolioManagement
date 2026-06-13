'use client';

import { Pencil, RefreshCw, Trash2 } from 'lucide-react';

const transactionLabels = {
  buy: '买入',
  sell: '卖出',
  convert_in: '转换转入',
  convert_out: '转换转出',
  dividend_cash: '现金分红',
  dividend_reinvest: '红利再投',
  cash_in: '现金转入',
  cash_out: '现金转出',
  fee: '手续费',
  adjustment: '手动调整'
};

const principalLabels = {
  increase: '增加',
  decrease: '减少',
  manual_adjustment: '手动调整'
};

const statusLabels = {
  planned: '计划',
  confirmed: '已确认'
};

const money = (value) =>
  Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const number = (value) =>
  Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 6
  });

export default function PortfolioTransactionsPanel({
  portfolioId,
  holdings = [],
  transactions = [],
  principalRecords = [],
  onEditTransaction,
  onDeleteTransaction,
  onRebuildLedger,
  canMutateLedger = true
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
        <h3>交易与本金记录</h3>
        <button
          type="button"
          className="button secondary"
          onClick={() => onRebuildLedger?.()}
          disabled={!canMutateLedger}
        >
          <RefreshCw size={16} />
          重建账本
        </button>
      </div>

      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>类型</th>
              <th>状态</th>
              <th>资产</th>
              <th>金额</th>
              <th>份额</th>
              <th>手续费</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {scopedTransactions.length ? (
              scopedTransactions.map((tx) => {
                const holding = holdingById.get(tx.holdingId);
                return (
                  <tr key={tx.id}>
                    <td>{tx.date || '-'}</td>
                    <td>{transactionLabels[tx.type] || tx.type}</td>
                    <td>
                      <span className={`portfolio-status-chip is-${tx.status || 'confirmed'}`}>
                        {statusLabels[tx.status] || '已确认'}
                      </span>
                    </td>
                    <td>{holding?.fundName || tx.fundCode || tx.holdingId || '-'}</td>
                    <td>{money(tx.amount)}</td>
                    <td>{number(tx.share)}</td>
                    <td>{money(tx.fee)}</td>
                    <td>
                      <div className="portfolio-row-actions">
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => onEditTransaction?.(tx)}
                          disabled={!canMutateLedger}
                          title="编辑交易"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => onDeleteTransaction?.(tx)}
                          disabled={!canMutateLedger}
                          title="删除交易"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>暂无交易记录。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>类型</th>
              <th>资产</th>
              <th>本金变动</th>
              <th>变动前</th>
              <th>变动后</th>
              <th>关联交易</th>
            </tr>
          </thead>
          <tbody>
            {scopedPrincipalRecords.length ? (
              scopedPrincipalRecords.map((record) => {
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
              })
            ) : (
              <tr>
                <td colSpan={7}>暂无本金记录。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
