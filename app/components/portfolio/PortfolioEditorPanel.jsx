'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudSun, Info, Landmark, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  ASSET_CLASSES,
  PORTFOLIO_TEMPLATE_OPTIONS,
  calculateAllocationTotal,
  createDefaultAllocations,
  createDefaultPortfolio,
  getAssetClassName,
  normalizeAllocationDraftPercents,
  normalizePortfolio,
  validateTargetAllocations,
} from '@/app/lib/portfolio';

const pct = (value) => `${((Number(value) || 0) * 100).toFixed(2)}%`;
const asPercent = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? (num * 100).toFixed(2).replace(/\.00$/, '') : '';
};
const fromPercent = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num / 100 : 0;
};
const templateName = (type) => PORTFOLIO_TEMPLATE_OPTIONS.find((row) => row.id === type)?.name || '组合模板';

const currencyOptions = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'];

function allocationDraftFromRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    assetClassId: row.assetClassId || 'other',
    assetClassName: row.assetClassName || getAssetClassName(row.assetClassId),
    targetPercent: asPercent(row.targetRatio),
    thresholdPercent: asPercent(row.rebalanceThreshold ?? 0.05),
  }));
}

function portfolioDraftFromPortfolio(portfolio) {
  return {
    name: portfolio?.name || '',
    type: portfolio?.type || 'custom',
    description: portfolio?.description || '',
    baseCurrency: portfolio?.baseCurrency || 'CNY',
    archived: Boolean(portfolio?.archived),
    allocations: allocationDraftFromRows(portfolio?.targetAllocations || createDefaultAllocations(portfolio?.type || 'custom')),
  };
}

function normalizedAllocationsFromDraft(draft) {
  return (draft.allocations || []).map((row) => ({
    assetClassId: row.assetClassId,
    assetClassName: getAssetClassName(row.assetClassId),
    targetRatio: fromPercent(row.targetPercent),
    rebalanceThreshold: fromPercent(row.thresholdPercent || 5),
  }));
}

export default function PortfolioEditorPanel({
  portfolio = null,
  onSavePortfolio,
  onDeletePortfolio,
  onCreatePortfolio,
  onDraftChange,
}) {
  const [draft, setDraft] = useState(() => portfolioDraftFromPortfolio(portfolio));

  useEffect(() => {
    setDraft(portfolioDraftFromPortfolio(portfolio));
  }, [portfolio]);

  const normalizedAllocations = useMemo(() => normalizedAllocationsFromDraft(draft), [draft]);
  const allocationTotal = useMemo(() => calculateAllocationTotal(normalizedAllocations), [normalizedAllocations]);
  const allocationValidation = useMemo(
    () => validateTargetAllocations(normalizedAllocations),
    [normalizedAllocations],
  );
  const normalizedDraft = useMemo(() => normalizePortfolio({
    ...(portfolio || {}),
    name: draft.name,
    type: draft.type,
    description: draft.description,
    baseCurrency: draft.baseCurrency,
    archived: draft.archived,
    targetAllocations: normalizedAllocations,
  }), [draft, normalizedAllocations, portfolio]);
  const canSave = Boolean(portfolio?.id && draft.name.trim() && allocationValidation.errors.length === 0);
  const totalTone = allocationValidation.isBalanced ? 'is-ok' : 'is-warning';

  useEffect(() => {
    onDraftChange?.({
      portfolio: normalizedDraft,
      allocationTotal,
      validation: allocationValidation,
    });
  }, [allocationTotal, allocationValidation, normalizedDraft, onDraftChange]);

  const updateAllocation = (index, patch) => {
    setDraft((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row, rowIndex) => (
        rowIndex === index ? { ...row, ...patch } : row
      )),
    }));
  };

  const applyTemplateToDraft = (type) => {
    setDraft((prev) => ({
      ...prev,
      type,
      allocations: allocationDraftFromRows(createDefaultAllocations(type)),
    }));
  };

  const normalizeAllocationsToHundred = () => {
    setDraft((prev) => ({
      ...prev,
      allocations: normalizeAllocationDraftPercents(prev.allocations),
    }));
  };

  const addAllocationRow = () => {
    setDraft((prev) => ({
      ...prev,
      allocations: [
        ...prev.allocations,
        {
          assetClassId: 'other',
          assetClassName: getAssetClassName('other'),
          targetPercent: '0',
          thresholdPercent: '5',
        },
      ],
    }));
  };

  const removeAllocationRow = (index) => {
    setDraft((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const savePortfolio = () => {
    if (!canSave) return;
    onSavePortfolio?.(normalizedDraft);
  };

  const deletePortfolio = () => {
    if (!portfolio?.id) return;
    onDeletePortfolio?.(portfolio.id);
  };

  const createFromTemplate = (type) => {
    const nextPortfolio = createDefaultPortfolio(type, {
      name: type === 'all_weather' ? '全天候组合' : templateName(type),
    });
    onCreatePortfolio?.(nextPortfolio);
  };

  return (
    <section className="portfolio-panel portfolio-editor-panel glass" aria-label="组合编辑">
      <div className="portfolio-panel-header portfolio-editor-header">
        <div>
          <span className="muted">Portfolio editor</span>
          <h3>组合设置</h3>
          <p>模板负责快速建立资产框架，保存后总览会按目标比例计算偏离。</p>
        </div>
        <div className="portfolio-editor-actions">
          <button type="button" className="button secondary" onClick={deletePortfolio} disabled={!portfolio?.id}>
            <Trash2 size={16} />
            删除
          </button>
          <button type="button" className="button" onClick={savePortfolio} disabled={!canSave}>
            <Save size={16} />
            保存
          </button>
        </div>
      </div>

      <div className="portfolio-template-shortcuts" aria-label="组合模板快捷入口">
        {PORTFOLIO_TEMPLATE_OPTIONS.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`button secondary ${draft.type === template.id ? 'is-active' : ''}`}
            onClick={() => applyTemplateToDraft(template.id)}
          >
            {template.id === 'permanent' && <Landmark size={16} />}
            {template.id === 'all_weather' && <CloudSun size={16} />}
            {template.id === 'custom' && <RotateCcw size={16} />}
            {template.name}
          </button>
        ))}
        <button type="button" className="button secondary" onClick={() => createFromTemplate('all_weather')}>
          <Plus size={16} />
          新建全天候
        </button>
      </div>

      <div className="portfolio-editor-tip" role="note">
        <Info size={16} aria-hidden="true" />
        <span>目标比例用百分数填写，例如 25 表示 25%；阈值表示偏离超过多少时提醒再平衡。</span>
      </div>

      <div className="portfolio-form portfolio-editor-form">
        <div className="portfolio-editor-name-row">
          <Field label="组合名称" hint="用于在顶部下拉框中识别不同策略。">
            <input
              className="input"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="例如：我的基金组合"
            />
          </Field>
          <Field label="币种" hint="常用币种。">
            <select
              className="select"
              value={draft.baseCurrency}
              onChange={(event) => setDraft((prev) => ({ ...prev, baseCurrency: event.target.value }))}
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className={`portfolio-detail-allocation portfolio-editor-total ${totalTone}`} aria-live="polite">
        <span>目标比例合计</span>
        <strong>{pct(allocationTotal)}</strong>
        {!allocationValidation.isBalanced && (
          <em>{allocationValidation.delta > 0 ? '超出 100%' : '未满 100%'}</em>
        )}
        {allocationValidation.isBalanced && <CheckCircle2 size={16} aria-hidden="true" />}
        <button
          type="button"
          className="button secondary portfolio-editor-total-action"
          onClick={normalizeAllocationsToHundred}
          disabled={!draft.allocations.length || allocationValidation.isBalanced}
        >
          按当前类别归一到 100%
        </button>
      </div>

      <div className="portfolio-allocation-editor">
        <div className="portfolio-allocation-head" aria-hidden="true">
          <span>资产类别</span>
          <span>目标比例</span>
          <span>偏离阈值</span>
          <span>操作</span>
        </div>
        {draft.allocations.map((row, index) => (
          <div key={`${row.assetClassId}-${index}`} className="portfolio-allocation-row">
            <select
              className="select"
              value={row.assetClassId}
              onChange={(event) => updateAllocation(index, { assetClassId: event.target.value })}
            >
              {ASSET_CLASSES.map((assetClass) => (
                <option key={assetClass.id} value={assetClass.id}>{assetClass.name}</option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={row.targetPercent}
              onChange={(event) => updateAllocation(index, { targetPercent: event.target.value })}
              aria-label={`${getAssetClassName(row.assetClassId)} 目标比例`}
            />
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={row.thresholdPercent}
              onChange={(event) => updateAllocation(index, { thresholdPercent: event.target.value })}
              aria-label={`${getAssetClassName(row.assetClassId)} 再平衡阈值`}
            />
            <button type="button" className="button secondary" onClick={() => removeAllocationRow(index)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="button secondary" onClick={addAllocationRow}>
          <Plus size={16} />
          添加资产类别
        </button>
      </div>

      <div className="portfolio-form portfolio-editor-description-form">
        <Field label="组合说明" hint="可记录策略纪律、调仓频率或风险边界。">
          <textarea
            className="input portfolio-editor-description"
            value={draft.description}
            onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="例如：长期持有，季度检查，偏离阈值触发再平衡。"
            rows={3}
          />
        </Field>
      </div>

      {(allocationValidation.errors.length > 0 || allocationValidation.warnings.length > 0) && (
        <div className="portfolio-detail-errors" role="alert">
          <span>校验提示</span>
          <ul>
            {[...allocationValidation.errors, ...allocationValidation.warnings].map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="portfolio-field">
      <span>{label}</span>
      {children}
      {hint && <em>{hint}</em>}
    </label>
  );
}
