# Business dashboard workspace

Open `business-dashboards.html` through any static web server. No build, dependencies or API keys are required. For a local preview run `node dashboard-server.cjs`, then visit http://127.0.0.1:4173/business-dashboards.html.

## Delivered features

- Executive: revenue, operating profit, prior-window revenue growth, customer acquisition, regional mix, team performance and strategic target attainment.
- Sales: monthly/quarterly revenue, product and region rankings, current opportunity pipeline, lead-to-win rate and average won value.
- Marketing: attributed campaign ROI, CAC, CTR, CPM, traffic, conversions, channel engagement and efficiency.
- Finance: revenue versus costs, margin, cash inflow/outflow, budget utilization and forecast variance.
- Operations: fulfillment, on-time delivery, supplier performance, lead times, inventory/reorder alerts and delayed orders.
- Shared date/region/team filters, monthly/quarterly trends, accessible tabular chart alternatives, record search/pagination/details, CSV export, print-to-PDF via the browser, CSV templates and JSON backup/restore.
- Responsive desktop/mobile layouts, homepage/tools/search/sitemap discovery and service-worker offline asset caching.
- Previous-period comparisons in every dashboard, with explicit date ranges, record counts and percentage-point rate changes.
- Up to 10 named filter views per tab session, covering dashboard, dates, region, team and trend grouping.
- Sortable records with numeric ordering; the filtered CSV follows the displayed sort order.
- Import preview, CSV append or replace, duplicate-ID rejection and one-step import undo.
- Create, edit and delete records in all five datasets, with schema validation and one-step undo for the most recent record change or import.
- Configurable on-screen alerts for profit margin, campaign ROI, win rate, budget utilization, low stock and overdue orders. Alerts follow current filters and link to affected records.
- Downloadable standalone HTML summary with scope, data classification, exact metric values, comparisons, all alerts, thresholds and dataset row counts. Open the file in a browser to print/save as PDF.

## Importing real data

Every import now opens a preview showing affected datasets, before/after row counts and the first five result rows. Apply commits the change; Cancel or Escape preserves existing data. The first CSV import clears every sample dataset to prevent mixing real and fictional data. Subsequent CSV imports either replace the selected dataset or append new unique IDs. Append rejects duplicate IDs rather than overwriting records. JSON supports full-workspace replace only. Invalid imports preserve the existing workspace. Undo last change restores the prior data, sample classification and filters; the next applied import or record change replaces the undo point, while loading sample data or clearing the workspace discards it. All processing happens locally in memory; closing or reloading the page discards data, saved filter views and undo history. Export a JSON backup to retain data. CSV templates and the in-page data contract list every required column and enum. Limits: 10 MB per import, 20,000 rows per dataset.

All monetary values use INR. Numerical fields cannot be blank and must be non-negative. Blank deliveredDate is allowed only for open orders. Dates use YYYY-MM-DD. IDs must be unique per dataset. Sales rows describe opportunity cohorts and current stages, not stage transition history. New customer counts and marketing attribution must be deduplicated upstream. Finance allocations and targets must not be repeated across rows. Date filters apply to each record's date; targets are not prorated for partial periods. Inventory uses the latest row in the filtered selection per region/supplier/product; id breaks same-day ties. Missing trend months show zero recorded activity, so source completeness matters. Zero-denominator rates and unavailable comparisons display an em dash.

Revenue growth compares the selected calendar range to the previous equal-length range; availability depends on imported history. Executive revenue uses finance while new customers use sales; marketing attribution is not added to accounting revenue. Executive CSV export contains the filtered finance ledger. Each other view exports its underlying dataset. Record search affects the table and CSV only, not KPI totals or charts. JSON backup includes all datasets.

## Testing

Run `node --test tests/dashboard-workflows.test.cjs` for validated record mutations, immutable undo-compatible state, alert rules and safe summary export. New records use the dataset selected in Data workspace. Existing record IDs are immutable. Editing sample data retains its sample label; start an empty workspace before entering real business data. Changes affect only the edited dataset and do not automatically synchronize sales with finance or marketing. All record edits are tab-local; download a JSON backup before closing. Saving or deleting a record replaces the one-step undo point. Clearing/loading a workspace discards that undo point.

Alert thresholds are tab-local and are not included in JSON backups. Executive shows alerts across the business; other views show their own dataset alerts. Low-stock checks use the latest selected inventory snapshot and each record's reorder point; overdue checks use the selected end date (or today if absent). A delivered order's lateness uses its actual delivery date. An empty or incomplete dataset may produce no alerts, so absence of alerts is not evidence of good performance. Alerts do not send messages or run in the background. The screen shows at most 50 alerts; the downloaded summary includes the full list. Summary metrics ignore record search, as clearly stated in the report.

Run `node --test tests/dashboard-core.test.cjs` for parsing, schema validation, reconciliation, filters, ratios, monthly/quarterly aggregation, stock snapshots and CSV injection protection. Browser checks should cover all five views, mobile overflow, filters, search, record details, CSV/JSON imports, invalid-import preservation, downloads and printing.

Run `node --test tests/dashboard-reporting.test.cjs` for comparison windows (including leap dates), missing-versus-zero metrics, weighted comparisons, stable numeric sorting and atomic import plans. Comparisons use the previous equal-length calendar range with the same region/team; a month-length range is not guaranteed to align to the previous calendar month. A record count does not prove complete source coverage. Changes are neutral comparisons, not automatically labelled improvements. Saved views are tab-local preferences and are not included in JSON data backups.

## Deployment and remaining integration scope

Serve the new HTML/CSS/JS alongside the existing site; the homepage and tools hub link to it. GitHub Pages needs no server changes. The service-worker cache version is bumped to refresh assets. Existing users may need to accept the site's update prompt.

This is a functioning file-driven reporting application. It does not include authenticated accounts, cloud storage, scheduled refreshes or live CRM/accounting/advertising/warehouse connectors. Those require the user's actual systems, credentials, metric mappings and a private backend; never put credentials or business datasets in this public repository. The public sample workspace is explicitly fictional.
