'use client';

import { useMemo, useState } from 'react';
import { ClipboardCheck, Download, Upload } from 'lucide-react';

const CSV_TYPE_OPTIONS = [
  { id: 'portfolioHoldings', label: '持仓 CSV' },
  { id: 'portfolioTransactions', label: '交易 CSV' },
  { id: 'portfolioSnapshots', label: '快照 CSV' },
];

const CONFLICT_MODE_OPTIONS = [
  { id: 'skip', label: '跳过已有记录', description: '导入 ID 已存在时保留当前记录。' },
  { id: 'overwrite', label: '覆盖已有记录', description: '导入 ID 已存在时用导入记录替换当前记录。' },
  { id: 'merge', label: '合并字段', description: '保留当前记录，并填充导入记录中的非空字段。' },
];

const CSV_TYPE_LABELS = Object.fromEntries(CSV_TYPE_OPTIONS.map((option) => [option.id, option.label]));

const normalizeOptions = (options, fallback) => {
  const source = Array.isArray(options) && options.length ? options : fallback;
  return source
    .map((option) => {
      if (typeof option === 'string') return { id: option, label: CSV_TYPE_LABELS[option] || option };
      if (!option?.id) return null;
      return {
        id: option.id,
        label: option.label || option.name || option.id,
        description: option.description || '',
      };
    })
    .filter(Boolean);
};

const getCountsEntries = (result) => {
  const counts = result?.counts;
  if (!counts || typeof counts !== 'object') return [];
  if ('valid' in counts || 'dropped' in counts) return [['当前类型', counts]];
  return Object.entries(counts);
};

const getPreviewRows = (result, maxPreviewRows) => {
  const rows = result?.previewRows || result?.rows || result?.normalizedRows || [];
  return Array.isArray(rows) ? rows.slice(0, maxPreviewRows) : [];
};

const formatCell = (value) => {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const summarizeRow = (row) => {
  if (!row || typeof row !== 'object') return String(row ?? '');
  const preferredKeys = ['id', 'portfolioId', 'holdingId', 'fundCode', 'fundName', 'assetClassId', 'type', 'date', 'amount', 'share', 'totalValue'];
  const visibleKeys = preferredKeys.filter((key) => row[key] != null && row[key] !== '');
  const keys = visibleKeys.length ? visibleKeys : Object.keys(row).slice(0, 6);
  return keys.map((key) => `${key}: ${formatCell(row[key])}`).join(' | ');
};

export default function PortfolioCsvImportPanel({
  csvText,
  onCsvTextChange,
  initialCsvText = '',
  initialType = 'portfolioTransactions',
  initialConflictMode = 'skip',
  csvTypes = CSV_TYPE_OPTIONS,
  conflictModes = CONFLICT_MODE_OPTIONS,
  analysis,
  onAnalyze,
  onApply,
  onExport,
  disabled = false,
  maxPreviewRows = 8,
  framed = true,
}) {
  const typeOptions = useMemo(() => normalizeOptions(csvTypes, CSV_TYPE_OPTIONS), [csvTypes]);
  const conflictOptions = useMemo(() => normalizeOptions(conflictModes, CONFLICT_MODE_OPTIONS), [conflictModes]);
  const [selectedType, setSelectedType] = useState(initialType);
  const [conflictMode, setConflictMode] = useState(initialConflictMode);
  const [draftText, setDraftText] = useState(initialCsvText);
  const [localResult, setLocalResult] = useState(null);
  const [generatedCsv, setGeneratedCsv] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [panelError, setPanelError] = useState('');

  const inputText = csvText ?? draftText;
  const result = analysis || localResult;
  const countsEntries = getCountsEntries(result);
  const errors = Array.isArray(result?.errors) ? result.errors : [];
  const previewRows = getPreviewRows(result, maxPreviewRows);
  const hasValidRows = (Number(result?.counts?.valid) || 0) > 0 || previewRows.length > 0 || result?.valid === true;
  const canAnalyze = typeof onAnalyze === 'function' && inputText.trim() && !disabled && !pendingAction;
  const canApply = typeof onApply === 'function' && !disabled && !pendingAction && hasValidRows;
  const canExport = typeof onExport === 'function' && !disabled && !pendingAction;
  const selectedConflict = conflictOptions.find((option) => option.id === conflictMode);

  const updateText = (nextText) => {
    if (csvText == null) setDraftText(nextText);
    onCsvTextChange?.(nextText);
    setPanelError('');
    setGeneratedCsv('');
    setLocalResult(null);
  };

  const runAction = async (action, callback) => {
    if (typeof callback !== 'function') return;
    setPendingAction(action);
    setPanelError('');
    try {
      const payload = { type: selectedType, conflictMode, csv: inputText, analysis: result };
      const nextResult = await callback(payload);
      if (action === 'export') {
        if (typeof nextResult === 'string') {
          setGeneratedCsv(nextResult);
        } else if (typeof nextResult?.csv === 'string') {
          setGeneratedCsv(nextResult.csv);
          setLocalResult(nextResult);
        } else if (nextResult) {
          setLocalResult(nextResult);
        }
      } else if (nextResult) {
        setLocalResult(nextResult);
      }
    } catch (error) {
      setPanelError(error?.message || String(error));
    } finally {
      setPendingAction('');
    }
  };

  return (
    <section className={framed ? 'portfolio-panel glass' : 'portfolio-csv-panel'} aria-label="CSV 导入导出">
      <div className="portfolio-panel-header">
        <div>
          <h3>CSV 导入 / 导出</h3>
          <span className="muted">先分析 CSV 内容，再把有效记录写入本地组合数据。</span>
        </div>
      </div>

      <div className="portfolio-form">
        <div className="portfolio-inline-form">
          <select className="select" value={selectedType} onChange={(event) => setSelectedType(event.target.value)} disabled={disabled || !!pendingAction}>
            {typeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <select className="select" value={conflictMode} onChange={(event) => setConflictMode(event.target.value)} disabled={disabled || !!pendingAction}>
            {conflictOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>

        <textarea
          className="portfolio-textarea"
          value={inputText}
          onChange={(event) => updateText(event.target.value)}
          placeholder="粘贴 CSV 内容，第一行必须是表头。"
          disabled={disabled || !!pendingAction}
        />

        <div className="portfolio-inline-form">
          <button type="button" className="button secondary" onClick={() => runAction('analyze', onAnalyze)} disabled={!canAnalyze}>
            <ClipboardCheck size={16} />
            {pendingAction === 'analyze' ? '分析中...' : '分析 CSV'}
          </button>
          <button type="button" className="button secondary" onClick={() => runAction('apply', onApply)} disabled={!canApply}>
            <Upload size={16} />
            {pendingAction === 'apply' ? '应用中...' : '应用有效记录'}
          </button>
          <button type="button" className="button secondary" onClick={() => runAction('export', onExport)} disabled={!canExport}>
            <Download size={16} />
            {pendingAction === 'export' ? '导出中...' : '导出 CSV'}
          </button>
        </div>

        {selectedConflict?.description && <span className="muted">{selectedConflict.description}</span>}

        {(panelError || errors.length > 0) && (
          <ul className="portfolio-import-errors">
            {panelError && <li>{panelError}</li>}
            {errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
          </ul>
        )}

        {countsEntries.length > 0 && (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>有效</th>
                  <th>已丢弃</th>
                </tr>
              </thead>
              <tbody>
                {countsEntries.map(([key, counts]) => (
                  <tr key={key}>
                    <td>{typeOptions.find((option) => option.id === key)?.label || key}</td>
                    <td>{counts?.valid || 0}</td>
                    <td>{counts?.dropped || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {previewRows.length > 0 && (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>行号</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={row?.id || `${selectedType}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{summarizeRow(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {generatedCsv && (
          <textarea className="portfolio-textarea" value={generatedCsv} readOnly aria-label="生成的 CSV" />
        )}
      </div>
    </section>
  );
}
