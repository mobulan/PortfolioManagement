'use client';

import { DatabaseZap } from 'lucide-react';

const countText = (value) => Number(value || 0).toLocaleString('zh-CN');

export default function PortfolioMigrationPanel({ preview, onRunMigration }) {
  const migratableCount = Number(preview?.migratableCount || preview?.holdings?.length || 0);
  const skippedCount = Number(preview?.skippedCount || 0);
  const holdings = Array.isArray(preview?.holdings) ? preview.holdings : [];
  const canRun = migratableCount > 0 && typeof onRunMigration === 'function';

  return (
    <section className="portfolio-panel glass">
      <div className="portfolio-panel-header">
        <div>
          <span className="muted">Legacy migration</span>
          <h3>旧持仓迁移预览</h3>
        </div>
        <button type="button" className="button" onClick={onRunMigration} disabled={!canRun}>
          <DatabaseZap size={16} />
          迁移持仓
        </button>
      </div>

      <div className="portfolio-stats">
        <div>
          <span className="muted">可迁移</span>
          <strong>{countText(migratableCount)}</strong>
        </div>
        <div>
          <span className="muted">已跳过</span>
          <strong>{countText(skippedCount)}</strong>
        </div>
      </div>

      {holdings.length > 0 ? (
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>基金代码</th>
                <th>基金名称</th>
                <th>份额</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              {holdings.slice(0, 8).map((holding) => (
                <tr key={holding.id || holding.fundCode}>
                  <td>{holding.fundCode || '-'}</td>
                  <td>{holding.fundName || '-'}</td>
                  <td>{countText(holding.share)}</td>
                  <td>{countText(holding.costAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">没有可迁移的旧持仓。</p>
      )}
    </section>
  );
}
