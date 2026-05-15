'use client';

import { DatabaseZap } from 'lucide-react';

const countText = (value) => Number(value || 0).toLocaleString('zh-CN');

export default function PortfolioMigrationPanel({
  preview,
  onRunMigration,
  eyebrow = '历史迁移',
  title = '迁移预览',
  actionLabel = '迁移持仓',
}) {
  const migratableCount = Number(preview?.migratableCount || preview?.holdings?.length || 0);
  const skippedCount = Number(preview?.skippedCount || 0);
  const holdings = Array.isArray(preview?.holdings) ? preview.holdings : [];
  const skipped = Array.isArray(preview?.skipped) ? preview.skipped : [];
  const canRun = migratableCount > 0 && typeof onRunMigration === 'function';

  return (
    <section className="portfolio-panel glass">
      <div className="portfolio-panel-header">
        <div>
          <span className="muted">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        {canRun ? (
          <button type="button" className="button" onClick={onRunMigration}>
            <DatabaseZap size={16} />
            {actionLabel}
          </button>
        ) : (
          <span className="portfolio-migration-status">
            <DatabaseZap size={16} />
            暂无可迁移
          </span>
        )}
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
        <p className="muted">暂无可迁移持仓。当前数据已经迁移完成，或没有可识别的旧持仓。</p>
      )}

      {skipped.length > 0 && (
        <ul className="portfolio-import-errors">
          {skipped.slice(0, 5).map((item, index) => (
            <li key={`${item.groupId || 'group'}-${item.fundCode || index}`}>
              {item.groupId ? `${item.groupId} / ` : ''}{item.fundCode || '-'}：{item.reason || '已跳过'}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
