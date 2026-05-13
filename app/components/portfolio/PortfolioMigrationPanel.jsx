'use client';

import { DatabaseZap } from 'lucide-react';

const countText = (value) => Number(value || 0).toLocaleString('zh-CN');

export default function PortfolioMigrationPanel({
  preview,
  onRunMigration,
  eyebrow = 'Legacy migration',
  title = 'Migration preview',
  actionLabel = 'Migrate holdings',
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
        <button type="button" className="button" onClick={onRunMigration} disabled={!canRun}>
          <DatabaseZap size={16} />
          {actionLabel}
        </button>
      </div>

      <div className="portfolio-stats">
        <div>
          <span className="muted">Migratable</span>
          <strong>{countText(migratableCount)}</strong>
        </div>
        <div>
          <span className="muted">Skipped</span>
          <strong>{countText(skippedCount)}</strong>
        </div>
      </div>

      {holdings.length > 0 ? (
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Fund code</th>
                <th>Fund name</th>
                <th>Shares</th>
                <th>Cost</th>
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
        <p className="muted">No migratable holdings found.</p>
      )}

      {skipped.length > 0 && (
        <ul className="portfolio-import-errors">
          {skipped.slice(0, 5).map((item, index) => (
            <li key={`${item.groupId || 'group'}-${item.fundCode || index}`}>
              {item.groupId ? `${item.groupId} / ` : ''}{item.fundCode || '-'}: {item.reason || 'skipped'}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
