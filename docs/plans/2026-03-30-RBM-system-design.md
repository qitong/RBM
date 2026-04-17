# RBM System Design Document
**Date:** 2026-03-30
**Topic:** Risk-Based Monitoring (RBM) System - Single Page/Dashboard Application

## Overview
This document outlines the design and architecture for a clinical Risk-Based Monitoring (RBM) system. The system focuses on tracking Protocol Deviations (PD), analyzing their standardized values across a 10%~100% visit progress timeline, and issuing alerts (Traffic Light System: Red/Yellow/Green) based on configured thresholds. The ultimate goal is to provide a closed-loop alert management workflow alongside a robust BI dashboard.

## Architecture & User Interface
The system will adopt a **Multi-page Dashboard Platform (分层多页系统)** approach, separating concerns into three main pillars:

1. **Risk Analytics Global Dashboard (BI 大屏)**
   - **Performance Matrix (9-grid layout)**: Displays risk levels across dimensions (Project, Site, Investigator) vs. PD Categories (Lab, ICF, IP, Safety, Procedure Test).
   - **Progress-based Trend Lines**: X-axis representing visit progress (10% -> 100%), Y-axis for standardized PD value. Areas will be shaded to indicate alert thresholds (Green, Yellow, Red zones).
   - **Correlation Scatter Plots**: E.g., visualizing Pearson/Spearman correlation between PDs and Queries.

2. **Alert Tracking Center (工单预警台)**
   - A Kanban/List interface where threshold breaches automatically generate action items (Tasks).
   - PM/CRAs use this to document **Root Cause** and **CAPA** (Corrective and Preventive Actions).
   - Supports status workflows (e.g., Open -> In Review -> Closed).

3. **Threshold Configuration Center (配置中心)**
   - Allows configuration of static threshold values (e.g., > 5% PD rate = Yellow) or dynamic statistical thresholds (e.g., > +1 Standard Deviation = Yellow).
   - Granular configuration down to the dimension level (e.g., specific rules for ICF vs. Lab).

## Data Flow & Mock Data Strategy (伪数据生成)
To demonstrate the capabilities and effectiveness of the RBM Dashboard, a robust mock data generation script will be implemented. 

### Schema
- `Projects`, `Sites`, `Investigators`, `PD Categories`
- `Progress Slices`: Data generated at 10% intervals up to 100%.

### Script Logic (Clinical Scenarios)
The pseudo-data script (written in Node.js/TypeScript) will inject specific narrative anomalies that trigger the system's alerts:
- **Scenario A (Project Level)**: At 50%-80% progress, standardized PDs for a specific project spike (due to simulated COVID-19 remote constraints).
- **Scenario B (Site Level)**: Between 10%-30% progress, a specific site (e.g., Site 1002) spikes in Lab-related PDs (due to protocol misunderstanding).
- **Scenario C (Investigator Level)**: A specific inexperienced investigator triggers elevated Procedure Test PDs across multiple assigned projects.
- **Scenario D (Correlation)**: Query volume linearly scales with PD volume with an added noise factor to effectively test Pearson/Spearman visualization.

## Technical Stack
- **Frontend / Framework**: Modern React framework (e.g., Next.js or Vite).
- **Styling**: TailwindCSS.
- **Visualization Component**: Recharts or ECharts for specialized scatter plots and multi-line progress charts.
- **Mock Script**: Standalone JavaScript/TypeScript file outputting structured JSON to feed the application state.
