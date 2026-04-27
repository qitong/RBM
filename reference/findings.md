# Findings & Decisions

## Requirements
<!-- Captured from user request -->
- Propose new modular features to add to the RBM system.
- Use the planning-with-files workflow.

## Research Findings
<!-- Key discoveries during exploration -->
Current RBM system includes:
- Global Risk Dashboard
- Alert Tracking
- Threshold Configuration
- Site Comparison (Benchmark)

Identified gaps and potential new modules for a comprehensive RBM platform:
1. **Data Quality & Query Management (数据质量与质疑管理)**: A module to track eCRF query resolution times, missing data trends, and data entry delays per site.
2. **Subject/Patient-Level Risk (受试者层面风险视图)**: While we have site-level metrics, we need a drill-down into individual subjects with high risk scores (e.g., severe AEs, multiple missed visits).
3. **Action Item & Task Management (工单与任务管理)**: A Kanban-style board for CRAs and Data Managers to assign, track, and resolve identified site risks.
4. **Predictive Analytics (预测性分析与早期预警)**: Forecasting future risks based on historical site performance trends.
5. **Audit Logs & Compliance (审计日志与系统监控)**: Tracking changes to threshold configurations and user logins for CFR 21 Part 11 compliance.
6. **Report Generation (自动化报告生成)**: Exporting site performance and risk reports to PDF/Excel for sponsor meetings.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- Existing Pages: `Dashboard.tsx`, `AlertTracking.tsx`, `ThresholdConfig.tsx`, `Benchmark.tsx`

## Visual/Browser Findings
- 
