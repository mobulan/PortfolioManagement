'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Save, X } from 'lucide-react';
import {
  applySmartTradeActualFills,
  calculateSmartCashPlan,
  createSmartTradeDrafts,
  parsePortfolioNumber
} from '@/app/lib/portfolio';

const money = (value) =>
  Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const number = (value, digits = 2) =>
  Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: digits
  });

const priceNumber = (value) =>
  Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });

const today = () => new Date().toISOString().slice(0, 10);

const modeLabels = {
  proportional: '按比例买卖',
  smart_fill: '填坑买入',
  smart_trim: '削峰卖出'
};

const typeLabels = {
  buy: '买入',
  sell: '卖出',
  cash_in: '现金转入',
  cash_out: '现金转出'
};

const warningLabels = {
  missing_price: '缺少价格，需手工确认',
  sell_clipped_to_available_value: '已按最大可卖市值截断'
};

function buildCopyText(rows = []) {
  return rows
    .map((row) =>
      [
        typeLabels[row.type] || row.type,
        row.fundCode,
        row.fundName,
        `金额 ${money(row.amount)}`,
        row.price ? `价格 ${priceNumber(row.price)}` : '价格 -',
        row.share ? `份额 ${number(row.share)}` : '份额 -'
      ]
        .filter(Boolean)
        .join(' | ')
    )
    .join('\n');
}

export default function PortfolioSmartTradePanel({ portfolio, holdings = [], funds = [], onApplyDrafts }) {
  const [direction, setDirection] = useState('buy');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [actualFills, setActualFills] = useState({});
  const parsedAmount = parsePortfolioNumber(amount, 0);
  const cashflow = direction === 'sell' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

  const plan = useMemo(
    () => (portfolio && parsedAmount > 0 ? calculateSmartCashPlan(portfolio, holdings, cashflow) : null),
    [cashflow, holdings, parsedAmount, portfolio]
  );

  const drafts = useMemo(
    () =>
      portfolio && plan
        ? createSmartTradeDrafts({
            portfolio,
            holdings,
            funds,
            plan,
            date
          })
        : { rows: [], warnings: [], blockingWarnings: [], mode: '' },
    [date, funds, holdings, plan, portfolio]
  );

  const filledRows = useMemo(() => applySmartTradeActualFills(drafts.rows, actualFills), [actualFills, drafts.rows]);
  const executableRows = filledRows.filter((row) => !row.warning || row.warning === 'sell_clipped_to_available_value');
  const hasBlockingWarnings =
    drafts.blockingWarnings.length > 0 || drafts.rows.some((row) => row.warning === 'missing_price');
  const executableAmount = executableRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const applyDrafts = (status = 'confirmed') => {
    if (!executableRows.length || hasBlockingWarnings) return;
    onApplyDrafts?.(
      executableRows.map((row) => ({ ...row, status })),
      { status }
    );
    setActualFills({});
    setAmount('');
  };

  const setActualFill = (rowId, field, value) => {
    setActualFills((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {}),
        [field]: value
      }
    }));
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
          <button type="button" className={direction === 'buy' ? 'is-active' : ''} onClick={() => setDirection('buy')}>
            买入
          </button>
          <button
            type="button"
            className={direction === 'sell' ? 'is-active' : ''}
            onClick={() => setDirection('sell')}
          >
            卖出
          </button>
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
          {drafts.rows
            .filter((row) => row.warning)
            .map((row) => (
              <li key={`${row.id}-${row.warning}`}>
                {row.fundName}: {warningLabels[row.warning] || row.warning}
              </li>
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
              <th className="portfolio-number-cell">成交金额</th>
              <th className="portfolio-number-cell">成交净值</th>
              <th className="portfolio-number-cell">成交份额</th>
              <th className="portfolio-number-cell">手续费</th>
            </tr>
          </thead>
          <tbody>
            {drafts.rows.length ? (
              filledRows.map((row) => (
                <tr key={row.id}>
                  <td>{typeLabels[row.type] || row.type}</td>
                  <td>
                    <strong>{row.fundName}</strong>
                  </td>
                  <td>{row.fundCode || '-'}</td>
                  <td>{row.assetClassName}</td>
                  <td className="portfolio-number-cell">
                    <input
                      className="input portfolio-table-input"
                      inputMode="decimal"
                      value={actualFills[row.id]?.amount ?? row.amount}
                      onChange={(event) => setActualFill(row.id, 'amount', event.target.value)}
                      aria-label={`${row.fundName}成交金额`}
                    />
                  </td>
                  <td className="portfolio-number-cell">
                    <input
                      className="input portfolio-table-input"
                      inputMode="decimal"
                      value={actualFills[row.id]?.price ?? row.price}
                      onChange={(event) => setActualFill(row.id, 'price', event.target.value)}
                      aria-label={`${row.fundName}成交净值`}
                    />
                  </td>
                  <td className="portfolio-number-cell">
                    <input
                      className="input portfolio-table-input"
                      inputMode="decimal"
                      value={actualFills[row.id]?.share ?? row.share}
                      onChange={(event) => setActualFill(row.id, 'share', event.target.value)}
                      aria-label={`${row.fundName}成交份额`}
                    />
                  </td>
                  <td className="portfolio-number-cell">
                    <input
                      className="input portfolio-table-input"
                      inputMode="decimal"
                      value={actualFills[row.id]?.fee ?? row.fee ?? 0}
                      onChange={(event) => setActualFill(row.id, 'fee', event.target.value)}
                      aria-label={`${row.fundName}手续费`}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>输入金额后自动生成每只基金的买卖金额和份额。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="portfolio-inline-form">
        <button
          type="button"
          className="button"
          onClick={() => applyDrafts('confirmed')}
          disabled={!executableRows.length || hasBlockingWarnings}
        >
          <Save size={16} />
          应用买卖草稿
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => applyDrafts('planned')}
          disabled={!executableRows.length || hasBlockingWarnings}
        >
          <ClipboardList size={16} />
          保存为计划
        </button>
        <button type="button" className="button secondary" onClick={copyRows} disabled={!drafts.rows.length}>
          <ClipboardList size={16} />
          复制操作清单
        </button>
        <button type="button" className="button ghost" onClick={() => setAmount('')} disabled={!amount}>
          <X size={16} />
          清空金额
        </button>
        <span className="muted">草稿默认使用预估净值，可在表格中批量回填实际成交后一次入账。</span>
      </div>
    </section>
  );
}
