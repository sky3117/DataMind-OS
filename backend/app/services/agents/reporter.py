import base64
import io
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

try:
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

import logging

logger = logging.getLogger(__name__)

REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")


def _df_to_html_table(df: pd.DataFrame, max_rows: int = 5) -> str:
    """Render a small dataframe as an HTML table."""
    return df.head(max_rows).to_html(
        classes="data-table", border=0, index=False, na_rep="—"
    )


def _chart_to_b64(fig) -> str:
    """Convert a matplotlib figure to a base64 PNG data-URI."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=90, bbox_inches="tight")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def _make_charts(df: pd.DataFrame) -> List[str]:
    """Generate base64 chart images for numeric columns."""
    charts: List[str] = []
    if not HAS_MATPLOTLIB:
        return charts

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    # Histogram grid (up to 4 cols)
    cols_to_plot = numeric_cols[:4]
    if cols_to_plot:
        n = len(cols_to_plot)
        fig, axes = plt.subplots(1, n, figsize=(5 * n, 3))
        if n == 1:
            axes = [axes]
        for ax, col in zip(axes, cols_to_plot):
            data = df[col].dropna()
            ax.hist(data, bins=20, color="#6366f1", edgecolor="white", linewidth=0.5)
            ax.set_title(col, fontsize=9)
            ax.set_facecolor("#1e293b")
            fig.patch.set_facecolor("#0f172a")
            ax.tick_params(colors="white", labelsize=7)
            for spine in ax.spines.values():
                spine.set_edgecolor("#334155")
        plt.tight_layout()
        charts.append(_chart_to_b64(fig))

    # Correlation heatmap
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols[:8]].corr()
        fig, ax = plt.subplots(figsize=(min(8, len(corr)), min(6, len(corr))))
        fig.patch.set_facecolor("#0f172a")
        ax.set_facecolor("#1e293b")
        cax = ax.matshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
        fig.colorbar(cax)
        ax.set_xticks(range(len(corr.columns)))
        ax.set_yticks(range(len(corr.columns)))
        ax.set_xticklabels(corr.columns, rotation=45, ha="left", fontsize=7, color="white")
        ax.set_yticklabels(corr.columns, fontsize=7, color="white")
        ax.set_title("Correlation Matrix", color="white", pad=20)
        plt.tight_layout()
        charts.append(_chart_to_b64(fig))

    return charts


_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{title}</title>
<style>
  body {{ font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
  .container {{ max-width: 1100px; margin: 0 auto; padding: 40px 24px; }}
  h1 {{ font-size: 2rem; color: #a5b4fc; margin-bottom: 4px; }}
  h2 {{ font-size: 1.25rem; color: #818cf8; margin: 32px 0 12px; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }}
  .meta {{ color: #94a3b8; font-size: 0.85rem; margin-bottom: 32px; }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }}
  .kpi {{ background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center; }}
  .kpi .val {{ font-size: 2rem; font-weight: 700; color: #a5b4fc; }}
  .kpi .lbl {{ font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }}
  .insight {{ background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 12px; }}
  .insight h3 {{ margin: 0 0 6px; font-size: 1rem; color: #c7d2fe; }}
  .insight p {{ margin: 0; font-size: 0.88rem; color: #94a3b8; line-height: 1.55; }}
  .badge {{ display: inline-block; font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; margin-left: 8px;
            background: #312e81; color: #a5b4fc; }}
  .chart-row {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; margin-bottom: 24px; }}
  .chart-box {{ background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; text-align: center; padding: 12px; }}
  .chart-box img {{ max-width: 100%; border-radius: 4px; }}
  table.data-table {{ width: 100%; border-collapse: collapse; font-size: 0.82rem; }}
  table.data-table th {{ background: #312e81; color: #e0e7ff; padding: 8px 10px; text-align: left; }}
  table.data-table td {{ padding: 6px 10px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }}
  table.data-table tr:hover td {{ background: #1e293b; }}
  .quality-bar-wrap {{ background: #1e293b; border-radius: 6px; overflow: hidden; height: 10px; margin-top: 6px; }}
  .quality-bar {{ height: 10px; border-radius: 6px; }}
  .footer {{ margin-top: 48px; text-align: center; color: #475569; font-size: 0.78rem; }}
</style>
</head>
<body>
<div class="container">
  <h1>{title}</h1>
  <p class="meta">Generated on {generated_at} &nbsp;|&nbsp; DataMind OS</p>

  <h2>Dataset Summary</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">{row_count}</div><div class="lbl">Rows</div></div>
    <div class="kpi"><div class="val">{col_count}</div><div class="lbl">Columns</div></div>
    <div class="kpi"><div class="val">{numeric_count}</div><div class="lbl">Numeric</div></div>
    <div class="kpi"><div class="val">{cat_count}</div><div class="lbl">Categorical</div></div>
    <div class="kpi"><div class="val">{missing_pct:.1f}%</div><div class="lbl">Missing Values</div></div>
    <div class="kpi"><div class="val">{dup_rows}</div><div class="lbl">Duplicate Rows</div></div>
  </div>

  <h2>Data Quality</h2>
  <p>Overall health score: <strong style="color:#a5b4fc">{health_score:.0f} / 100</strong></p>
  <div class="quality-bar-wrap">
    <div class="quality-bar" style="width:{health_score:.0f}%;background:{health_color};"></div>
  </div>

  <h2>Key Metrics</h2>
  <div class="kpi-grid">
    {metric_cards}
  </div>

  <h2>Top Insights</h2>
  {insight_html}

  {charts_section}

  <h2>Data Sample</h2>
  {sample_table}

  <div class="footer">Report generated by DataMind OS &mdash; {generated_at}</div>
</div>
</body>
</html>
"""


class ReporterAgent:
    """Generate HTML reports from data analysis."""

    @staticmethod
    async def generate_report(
        df: pd.DataFrame,
        file_id: str,
        title: Optional[str] = None,
        include_charts: bool = True,
    ) -> Dict[str, Any]:
        """Generate an HTML report and save it to the reports directory."""
        os.makedirs(REPORTS_DIR, exist_ok=True)
        report_id = f"report_{file_id}_{uuid.uuid4().hex[:8]}"
        title = title or "Data Analysis Report"
        generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

        total_cells = df.size
        missing_pct = float((df.isnull().sum().sum() / total_cells) * 100) if total_cells else 0
        dup_rows = int(df.duplicated().sum())

        # Health score
        penalty = missing_pct * 0.5 + (dup_rows / max(len(df), 1)) * 30
        health_score = max(0.0, min(100.0, 100.0 - penalty))
        health_color = "#22c55e" if health_score > 70 else "#f59e0b" if health_score > 40 else "#ef4444"

        # Key metrics cards (mean/min/max for first 4 numeric cols)
        metric_cards_html = ""
        for col in numeric_cols[:4]:
            s = df[col].dropna()
            if len(s):
                metric_cards_html += (
                    f'<div class="kpi">'
                    f'<div class="val">{s.mean():.2f}</div>'
                    f'<div class="lbl">{col} (mean)</div>'
                    f'</div>'
                )

        # Insights section
        from app.services.agents.analyst import AnalystAgent
        analyst_result = await AnalystAgent.generate_insights(df)
        insight_html = ""
        for ins in analyst_result["insights"][:6]:
            conf_pct = int(ins["confidence"] * 100)
            insight_html += (
                f'<div class="insight">'
                f'<h3>{ins["title"]}<span class="badge">{conf_pct}% confidence</span></h3>'
                f'<p>{ins["description"]}</p>'
                f'</div>'
            )
        if not insight_html:
            insight_html = "<p style='color:#64748b'>No insights generated.</p>"

        # Charts
        charts_section = ""
        if include_charts and HAS_MATPLOTLIB:
            chart_images = _make_charts(df)
            if chart_images:
                charts_section = "<h2>Charts</h2><div class='chart-row'>"
                for img in chart_images:
                    charts_section += f'<div class="chart-box"><img src="{img}" alt="chart"/></div>'
                charts_section += "</div>"

        # Sample table
        sample_table = _df_to_html_table(df, max_rows=8)

        html = _HTML_TEMPLATE.format(
            title=title,
            generated_at=generated_at,
            row_count=len(df),
            col_count=len(df.columns),
            numeric_count=len(numeric_cols),
            cat_count=len(cat_cols),
            missing_pct=missing_pct,
            dup_rows=dup_rows,
            health_score=health_score,
            health_color=health_color,
            metric_cards=metric_cards_html,
            insight_html=insight_html,
            charts_section=charts_section,
            sample_table=sample_table,
        )

        report_path = Path(REPORTS_DIR) / f"{report_id}.html"
        report_path.write_text(html, encoding="utf-8")

        return {
            "report_id": report_id,
            "html_url": f"/reports/{report_id}.html",
            "generated_at": datetime.utcnow().isoformat(),
            "title": title,
        }
