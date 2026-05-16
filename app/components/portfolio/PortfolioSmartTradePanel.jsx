'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Save, X } from 'lucide-react';
import {
  calculateSmartCashPlan,
  createSmartTradeDrafts,
  parsePortfolioNumber,
} from '@/app/lib/portfolio';

const money = (value) => Number(value || 0).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = (value, digits = 2) => Number(value || 0).toLocaleString('zh-CN', {
  maximumFractionDigits: digits,
});

const priceNumber = (value) => Number(value || 0).toLocaleString('zh-CN', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const today = () => new Date().toISOString().slice(0, 10);

const modeLabels = {
  proportional: '按比例买卖',
  smart_fill: '填坑买入',
  smart_trim: '削峰卖出',
};

const typeLabels = {
  buy: '买入',
  sell: '卖出',
  cash_in: '现金转入',
  cash_out: '现金转出',
};

const warningLabels = {
  missing_price: '缺少价格，需手工确认',
  sell_clipped_to_available_value: '已按最大可卖市值截断',
};

function buildCopyText(rows = []) {
  return rows.map((row) => [
    typeLabels[row.type] || row.type,
    row.fundCode,
    row.fundName,
    `金额 ${money(row.amount)}`,
    row.price ? `价格 ${priceNumber(row.price)}` : '价格 -',
    row.share ? `份额 ${number(row.share)}` : '份额 -',
  ].filter(Boolean).join(' | ')).join('\n');
}

export default function PortfolioSmartTradePanel({
  portfolio,
  holdings = [],
  funds = [],
  onApplyDrafts,
}) {
  const [direction, setDirection] = useState('buy');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const parsedAmount = parsePortfolioNumber(amount, 0);
  const cashflow = direction === 'sell' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

  const plan = useMemo(() => (
    portfolio && parsedAmount > 0
      ? calculateSmartCashPlan(portfolio, holdings, cashflow)
      : null
  ), [cashflow, holdings, parsedAmount, portfolio]);

  const drafts = useMemo(() => (
    portfolio && plan
      ? createSmartTradeDrafts({
        portfolio,
        holdings,
        funds,
        plan,
        date,
      })
      : { rows: [], warnings: [], blockingWarnings: [], mode: '' }
  ), [date, funds, holdings, plan, portfolio]);

  const executableRows = drafts.rows.filter((row) => !row.warning || row.warning === 'sell_clipped_to_available_value');
  const hasBlockingWarnings = drafts.blockingWarnings.length > 0 || drafts.rows.some((row) => row.warning === 'missing_price');
  const executableAmount = executableRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const applyDrafts = () => {
    if (!executableRows.length || hasBlockingWarnings) return;
    onApplyDrafts?.(executableRows);
  };

  const copyRows = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !drafts.rows.length) return;
    await navigator.clipboard.writeText(buildCopyText(drafts.rows));
  };

  return (
    <section className="portfolio-panel glass">
      <div className="portfolio-panel-header">
        <div>
          <h3>智能买卖</h3>
          <p className="portfolio-panel-intro">输入本次买入预算或卖出金额，系统会实时换算每只基金的金额和预估份额。</p>
        </div>
      </div>

      <div className="portfolio-form portfolio-smart-trade-form">
        <div className="portfolio-mode-toggle" role="group" aria-label="买卖方向">
          <button type="button" className={direction === 'buy' ? 'is-active' : ''} onClick={() => setDirection('buy')}>买入</button>
          <button type="button" className={direction === 'sell' ? 'is-active' : ''} onClick={() => setDirection('sell')}>卖出</button>
        </div>
        <input
          className="input"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={direction === 'buy' ? '输入本次买入预算' : '输入本次卖出金额'}
        />
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <div className="portfolio-summary-grid">
        <div className="portfolio-metric">
          <span>本次模式</span>
          <strong>{modeLabels[drafts.mode] || '等待输入'}</strong>
        </div>
        <div className="portfolio-metric">
          <span>输入金额</span>
          <strong>¥{money(parsedAmount)}</strong>
        </div>
        <div className="portfolio-metric">
          <span>可执行金额</span>
          <strong>¥{money(executableAmount)}</strong>
        </div>
        <div className="portfolio-metric">
          <span>提示</span>
          <strong>{drafts.blockingWarnings.length + drafts.warnings.length}</strong>
        </div>
      </div>

      {(drafts.blockingWarnings.length > 0 || drafts.warnings.length > 0) && (
        <ul className="portfolio-import-errors" role="alert">
          {drafts.blockingWarnings.map((warning) => (
            <li key={`${warning.code}-${warning.assetClassId || 'all'}`}>{warning.message || warning.code}</li>
          ))}
          {drafts.rows.filter((row) => row.warning).map((row) => (
            <li key={`${row.id}-${row.warning}`}>{row.fundName}: {warningLabels[row.warning] || row.warning}</li>
          ))}
        </ul>
      )}

      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>操作</th>
              <th>基金</th>
              <th>编号</th>
              <th>类别</th>
              <th className="portfolio-number-cell">金额</th>
              <th className="portfolio-number-cell">参考价格</th>
              <th className="portfolio-number-cell">预估份额</th>
            </tr>
          </thead>
          <tbody>
            {drafts.rows.length ? drafts.rows.map((row) => (
              <tr key={row.id}>
                <td>{typeLabels[row.type] || row.type}</td>
                <td>
                  <strong>{row.fundName}</strong>
                </td>
                <td>{row.fundCode || '-'}</td>
                <td>{row.assetClassName}</td>
                <td className="portfolio-number-cell">¥{money(row.amount)}</td>
                <td className="portfolio-number-cell">{row.price ? priceNumber(row.price) : '-'}</td>
                <td className="portfolio-number-cell">{row.share ? number(row.share) : '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>输入金额后自动生成每只基金的买卖金额和份额。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="portfolio-inline-form">
        <button type="button" className="button" onClick={applyDrafts} disabled={!executableRows.length || hasBlockingWarnings}>
          <Save size={16} />
          应用买卖草稿
        </button>
        <button type="button" className="button secondary" onClick={copyRows} disabled={!drafts.rows.length}>
          <ClipboardList size={16} />
          复制操作清单
        </button>
        <button type="button" className="button ghost" onClick={() => setAmount('')} disabled={!amount}>
          <X size={16} />
          清空金额
        </button>
        <span className="muted">份额按今日预估净值测算，实际成交以基金平台确认为准。</span>
      </div>
    </section>
  );
}
