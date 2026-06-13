# PortfolioManagement 项目进展汇报

> 历史快照：本文记录 2026-05-13 状态。最新完成度与验收结果见 `docs/portfolio-current-progress-2026-06-13.md`。

生成日期：2026-05-13  
汇报对象：个人资金管理看板 + 投资组合管理工具  
基线仓库：`real-time-fund` 二次开发，当前分支 `main`，最新本地提交 `a89e79b feat: advance portfolio migration and dashboard workflows`

## 1. 汇报结论

当前项目已经从“基金实时估值工具”扩展为“本地优先的投资组合管理 MVP”。组合数据模型、持仓管理、交易流水、再平衡建议、交易草案、历史快照、JSON/CSV 导入导出、迁移预览、基础风险摘要和手动回测都已落地。

按 PRD 覆盖度估算，当前整体完成度约为 **82%**。其中 P0 主流程大部分已经可用，剩余工作主要集中在用户提示精细化、浏览器级回归测试、XLSM 映射、图表增强、历史净值驱动回测、相关性分析和 Supabase 多设备实测。

## 2. 当前状态概览

| 里程碑             | 完成度 | 当前判断                                                                                         |
| ------------------ | -----: | ------------------------------------------------------------------------------------------------ |
| 仓库与基线         |   100% | `origin` 指向 PortfolioManagement，`upstream` 保留原项目，可继续合并上游。                       |
| 数据核心           |    90% | 组合 schema、storage keys、计算、交易、快照、导入导出、迁移、回测 helper 已具备。                |
| 可用组合管理       |    85% | 支持组合创建、编辑、删除、归档、持仓录入、交易流水、历史、回测、迁移和导入导出。                 |
| Dashboard 与再平衡 |    78% | 已有资产总览、偏离计算、再平衡建议、可执行交易草案、风险与贡献摘要；趋势图和组合卡片仍待增强。   |
| 历史与迁移         |    70% | 已有手动快照、自动每日快照选项、JSON/CSV 导入导出、全局持仓和分组持仓迁移预览；XLSM 映射未完成。 |
| 回测与增强         |    35% | 已有手动净值序列回测和风险指标；历史 NAV 驱动回测、相关性矩阵、报告化输出和 AI 分析仍待实现。    |

## 3. 已完成能力

### 3.1 仓库与工程基线

- 本地分支 `main` 跟踪 `origin/main`。
- `origin`：`https://github.com/mobulan/PortfolioManagement.git`。
- `upstream`：`https://github.com/hzm0321/real-time-fund.git`。
- 项目仍保持 Next.js 16 App Router、纯 JavaScript、localStorage-first、静态导出兼容的技术路线。
- 没有重写原基金估值主流程，组合功能以新增组合层方式接入。

### 3.2 组合数据层

已新增 `app/lib/portfolio/` 领域模块：

- `schema.js`：组合、持仓、交易、本金记录、资产类别、配置模板和校验。
- `calculations.js`：组合汇总、资产类别汇总、收益和占比计算。
- `rebalance.js`：再平衡计划、智能现金流、再平衡交易草案。
- `transactionEngine.js`：买入、卖出、现金流、转换、流水重建、交易 baseline。
- `snapshot.js`：手动快照、自动每日快照 proposal。
- `dashboardRisk.js`：趋势、贡献、风险预警摘要。
- `importExport.js`：JSON 导入导出、CSV 解析、CSV 预览、冲突模式、CSV 导出。
- `migrations.js`：原全局持仓迁移预览、分组持仓迁移预览。
- `backtest.js`：手动净值序列风险指标、相关性计算。
- `holdingForm.js`、`editorForm.js`：持仓表单和组合编辑辅助逻辑。

### 3.3 本地持久化与同步兼容

已在 `storageStore` 中加入组合相关 key：

- `portfolios`
- `portfolioHoldings`
- `portfolioTransactions`
- `portfolioPrincipalRecords`
- `portfolioSnapshots`
- `portfolioBacktests`
- `portfolioSettings`
- `portfolioSchemaVersion`

这些 key 已纳入本地状态管理，并具备纳入云同步 payload 的基础。仍需真实多设备 Supabase 验证。

### 3.4 产品 UI 与工作区

组合入口已接入 PC 顶部 tab 和移动端入口。核心组件位于 `app/components/portfolio/`：

- `PortfolioWorkspace.jsx`
- `PortfolioDetailTabs.jsx`
- `PortfolioEditorPanel.jsx`
- `PortfolioTransactionsPanel.jsx`
- `PortfolioHistoryImportPanel.jsx`
- `PortfolioMigrationPanel.jsx`
- `PortfolioBacktestPanel.jsx`
- `PortfolioCsvImportPanel.jsx`

当前 workspace 支持：

- 组合总览、资产汇总和基础 dashboard。
- 组合创建、编辑、归档、删除。
- 永久组合、全天候/模板化配置、自定义组合。
- 目标资产比例编辑和一键归一化到 100%。
- 组合持仓录入，支持基金搜索、金额模式、份额模式、现金/手动资产。
- 持仓软删除。
- 交易和本金流水查看。
- 交易 baseline 捕获、删除交易后重建流水。
- 再平衡建议、智能现金流、可执行交易草案、应用草案。
- 手动快照、自动每日快照开关和幂等生成。
- JSON 导入分析、保护性应用和导出。
- CSV 分析、冲突模式、应用和导出。
- 原全局持仓迁移预览、分组持仓迁移预览。
- 手动净值序列回测和结果保存。
- 风险预警、贡献摘要、快照趋势摘要和最大回撤摘要。

## 4. PRD 对照

| PRD 模块       | 当前状态           | 说明                                                                               |
| -------------- | ------------------ | ---------------------------------------------------------------------------------- |
| 统一资产看板   | 基础完成           | 有总资产、本金、收益、组合汇总和风险摘要；仍缺更丰富趋势图、组合卡片和视觉化分析。 |
| 细粒度持仓管理 | 基本完成           | 支持同一资产类别多基金/现金/手动资产，支持金额模式和份额模式。                     |
| 投资组合管理   | 基本完成           | 支持默认组合、模板、编辑、归档、删除、自定义配置。                                 |
| 实时估值联动   | 部分完成           | 添加持仓时复用基金搜索和估值数据；组合内估值刷新还需要更多端到端浏览器验证。       |
| 交易与本金记录 | 基本完成           | 支持交易引擎、本金记录、交易 baseline、删除重建；UI 校验和编辑细节仍需增强。       |
| 再平衡建议     | 基本完成           | 支持偏离计算、智能现金流、交易草案和应用草案；解释性和强制再平衡 UX 仍可增强。     |
| 历史归档       | 基本完成           | 支持手动快照和自动每日快照选项；趋势图和日历化展示仍待增强。                       |
| 导入导出       | 中等完成           | JSON 和 CSV helper/UI 已有；XLSM/Excel 字段映射未完成，冲突预览还可更细。          |
| 可视化分析     | 初步完成           | 有风险、贡献、回撤、快照摘要；缺完整趋势图、资产分布图、组合卡片。                 |
| 组合回测       | 初步完成           | 有手动净值序列风险指标；未接入基金历史 NAV 自动回测和相关性矩阵 UI。               |
| 云端同步兼容   | 结构完成，实测待补 | 组合 key 已接入状态和 payload 思路；还没有完整多设备实测报告。                     |
| AI/智能建议    | 未开始             | P2，当前未实现。                                                                   |

## 5. 当前验证结果

当前进展文档记录的最新验证均通过：

```bash
npm run lint
node scripts/portfolio-smoke-test.mjs
node scripts/portfolio-import-smoke-test.mjs
node scripts/portfolio-transaction-smoke-test.mjs
node scripts/portfolio-dashboard-smoke-test.mjs
node scripts/portfolio-migration-smoke-test.mjs
node scripts/portfolio-snapshot-smoke-test.mjs
npm run build
git diff --check
Invoke-WebRequest http://localhost:3000
```

验证含义：

- 纯模块烟测覆盖数据模型、持仓、交易、再平衡、导入导出、迁移、快照、风险指标和回测边界。
- ESLint 通过。
- Next.js production build 通过。
- 本地服务 HTTP 访问返回 200。

已知验证噪音：

- Node 会提示 `MODULE_TYPELESS_PACKAGE_JSON`，原因是 portfolio 模块使用 ESM 语法但 `package.json` 未声明 `"type": "module"`。
- 某些 PowerShell 会提示 profile 执行策略警告，不影响命令结果。
- 浏览器级 UI 回归测试仍是后续必须补的质量门。

## 6. 未完成需求与代办清单

### 6.1 P0 近期待办

| 项目              | 目标                                     | 建议处理                                                                        |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| 导入冲突提示增强  | 用户能清楚知道哪些记录被跳过、覆盖或合并 | 在 CSV/JSON import UI 中增加逐行冲突预览、操作结果摘要和撤销提示。              |
| 交易编辑/删除体验 | 减少误删误改风险                         | 对交易删除、重建、应用再平衡草案增加二次确认、影响说明和失败提示。              |
| 浏览器级回归      | 证明 UI 真实可用                         | 用 Browser/Playwright 覆盖组合创建、加持仓、交易、再平衡、CSV、迁移、自动快照。 |
| 编码显示问题      | 部分旧文本出现乱码                       | 清理中文显示乱码，优先处理组合工作区、风险提示和 tab 文案。                     |

### 6.2 P1 产品增强

| 项目                | 目标                             | 建议处理                                                  |
| ------------------- | -------------------------------- | --------------------------------------------------------- |
| Dashboard 趋势图    | 展示资产、收益率、回撤随时间变化 | 基于 `portfolioSnapshots` 接入 Chart.js 或现有图表组件。  |
| 组合卡片区          | 快速比较多个组合                 | 展示金额、收益率、今日收益、偏离度和再平衡状态。          |
| 资产分布图          | 直观看股票、债券、黄金、现金占比 | 增加环形图或条形图，移动端提供简化视图。                  |
| CSV 冲突模式精细化  | 让 `skip/overwrite/merge` 更可控 | 增加逐行 diff、冲突数量、字段级 merge 提示。              |
| XLSM/Excel 映射     | 承接原永久投资组合表格           | 建立字段映射 UI，支持导入持仓、交易、历史快照。           |
| 历史 NAV 回测       | 从基金代码和权重自动拉历史净值   | 复用现有基金数据源，生成组合净值序列。                    |
| 相关性矩阵 UI       | 判断资产相关性和集中风险         | 基于回测收益序列生成矩阵热力图。                          |
| 保存回测报告        | 可复盘不同组合参数               | 将回测输入、指标、图表和结论保存到 `portfolioBacktests`。 |
| Supabase 多设备验证 | 确认云同步不丢数据               | 建立测试脚本或手工记录，覆盖所有组合 keys。               |

### 6.3 P2 智能化与报告化

| 项目         | 目标                           | 建议处理                                             |
| ------------ | ------------------------------ | ---------------------------------------------------- |
| AI 分析摘要  | 用自然语言解释组合状态         | 基于 summary、risk、rebalance、snapshot 生成摘要。   |
| 组合报告     | 输出月报/季报/年度回顾         | 生成 HTML/PDF/Markdown 报告。                        |
| 高级风险建议 | 解释集中度、相关性、再平衡原因 | 将 risk alerts 和 correlation 组合成建议引擎。       |
| 再平衡解释性 | 让用户知道为什么买/卖          | 每条交易草案附带目标比例、当前比例、偏离和金额来源。 |

## 7. 风险与注意事项

| 风险                    | 影响                             | 当前建议                                                         |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `page.jsx` 仍较单体     | 后续集成容易出现耦合和回归       | 新增组合逻辑继续保持组件化和 helper 纯函数化。                   |
| localStorage 是主数据库 | 数据迁移和冲突处理必须保守       | 所有导入、迁移、删除都要先 preview，再 apply。                   |
| 浏览器级测试不足        | 纯模块通过不代表 UI 流程完全可靠 | 下一轮优先补核心路径浏览器测试。                                 |
| 中文乱码残留            | 汇报和真实 UI 可读性受影响       | 做一次编码和文案清理专项。                                       |
| ESM 警告                | 不影响运行，但影响验证输出清晰度 | 可评估添加 `"type": "module"` 的影响，或调整 smoke import 方式。 |
| Supabase 未实测         | 多设备同步承诺还不充分           | 在真实账号和两端设备上做同步矩阵验证。                           |

## 8. 下一阶段建议路线

### 阶段 A：P0 收口和质量门

目标：把当前 MVP 从“功能已接通”推进到“日常可放心使用”。

- 清理乱码文案。
- 增强导入冲突提示。
- 增强交易删除、重建和再平衡应用确认。
- 建立浏览器级核心流程回归。
- 形成一份可重复执行的 QA checklist。

### 阶段 B：Dashboard 可视化增强

目标：让组合管理从表格工具变成真正的资产看板。

- 增加组合卡片。
- 增加资产分布图。
- 增加资产净值和收益率趋势图。
- 增加贡献分析和风险提示的图形化呈现。

### 阶段 C：迁移和回测深化

目标：替代现有 Excel，并开始提供组合研究能力。

- 完成 XLSM/Excel 字段映射。
- 接入历史 NAV 驱动回测。
- 增加相关性矩阵。
- 保存回测报告。

### 阶段 D：同步和智能报告

目标：提升长期使用价值。

- 完成 Supabase 多设备同步验证。
- 增加 AI 组合摘要。
- 增加月报/季报导出。
- 增强再平衡解释性。

## 9. 交付物索引

| 类型           | 路径                                            |
| -------------- | ----------------------------------------------- |
| 当前进展源文档 | `docs/portfolio-current-progress-2026-05-12.md` |
| PRD 源文档     | `docs/PRD-PortfolioManagement.md`               |
| 测试用例矩阵   | `docs/portfolio-test-cases.md`                  |
| 本汇总底稿     | `docs/presentation.md`                          |
| HTML 汇报页    | `docs/presentation.html`                        |
