'use client';

import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';

import { analyzePortfolioExcelRows } from '@/app/lib/portfolio';

export default function PortfolioExcelImportPanel({ portfolioId = '', onApply }) {
  const [analysis, setAnalysis] = useState(null);
  const [conflictMode, setConflictMode] = useState('skip');
  const [fileName, setFileName] = useState('');
  const [pending, setPending] = useState(false);

  const readFile = async (file) => {
    if (!file) return;
    setPending(true);
    setFileName(file.name);
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const rows = await readXlsxFile(file);
      setAnalysis(analyzePortfolioExcelRows(rows, { portfolioId }));
    } catch (error) {
      setAnalysis({
        valid: false,
        snapshots: [],
        errors: [`Excel 解析失败：${error?.message || '未知错误'}`],
        headers: []
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="portfolio-panel glass">
      <h3>Excel 历史导入</h3>
      <p className="portfolio-panel-intro">
        支持读取 XLSX/XLSM 工作表数据，不执行宏。首行需包含日期、总资产或四类资产市值。
      </p>
      <div className="portfolio-form">
        <label className="portfolio-file-picker">
          <FileSpreadsheet size={18} />
          <span>{pending ? '正在解析...' : fileName || '选择 Excel 文件'}</span>
          <input
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
            onChange={(event) => readFile(event.target.files?.[0])}
          />
        </label>
        <select className="select" value={conflictMode} onChange={(event) => setConflictMode(event.target.value)}>
          <option value="skip">跳过同日快照</option>
          <option value="overwrite">覆盖同日快照</option>
        </select>
        {analysis && (
          <>
            <div className="portfolio-summary-grid">
              <Metric label="识别列数" value={analysis.headers.length} />
              <Metric label="有效快照" value={analysis.snapshots.length} />
              <Metric label="错误数" value={analysis.errors.length} />
            </div>
            {analysis.snapshots.length > 0 && (
              <div className="portfolio-table-wrap">
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>总资产</th>
                      <th>总本金</th>
                      <th>当日收益</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.snapshots.slice(0, 8).map((snapshot) => (
                      <tr key={snapshot.id}>
                        <td>{snapshot.date}</td>
                        <td>{snapshot.totalValue.toFixed(2)}</td>
                        <td>{snapshot.totalPrincipal.toFixed(2)}</td>
                        <td>{snapshot.dailyProfit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {analysis.errors.length > 0 && (
              <ul className="portfolio-import-errors">
                {analysis.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={!analysis.snapshots.length}
              onClick={() => onApply?.({ snapshots: analysis.snapshots, conflictMode })}
            >
              <Upload size={16} />
              应用 {analysis.snapshots.length} 条快照
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="portfolio-metric is-compact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
