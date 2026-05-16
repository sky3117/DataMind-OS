import pandas as pd
import numpy as np
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

_MAX_CORRELATIONS = 5
_MIN_CORR_THRESHOLD = 0.5


class AnalystAgent:
    """Generate insights and analysis from data."""

    @staticmethod
    async def generate_insights(df: pd.DataFrame) -> Dict[str, Any]:
        """Generate insights from the dataframe."""
        insights = []
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

        # 1. Correlation insights (top 5 pairs)
        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            pairs = []
            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    corr_val = corr_matrix.iloc[i, j]
                    if not np.isnan(corr_val):
                        pairs.append((numeric_cols[i], numeric_cols[j], float(corr_val)))
            pairs.sort(key=lambda x: abs(x[2]), reverse=True)
            for col1, col2, corr_val in pairs[:_MAX_CORRELATIONS]:
                direction = "positive" if corr_val > 0 else "negative"
                strength = "strong" if abs(corr_val) > 0.7 else "moderate"
                chart_data = {
                    "type": "scatter",
                    "x": col1,
                    "y": col2,
                    "data": df[[col1, col2]].dropna().head(100).to_dict(orient="list"),
                }
                insights.append({
                    "id": f"corr_{col1}_{col2}",
                    "title": f"{strength.title()} {direction} correlation: {col1} ↔ {col2}",
                    "description": (
                        f"There is a {strength} {direction} correlation ({corr_val:.2f}) "
                        f"between '{col1}' and '{col2}'."
                    ),
                    "insight_type": "correlation",
                    "confidence": round(abs(corr_val), 2),
                    "chart_data": chart_data,
                })

        # 2. Trend analysis per numeric column
        for col in numeric_cols[:6]:
            series = df[col].dropna()
            if len(series) < 4:
                continue
            half = len(series) // 2
            first_half_mean = float(series.iloc[:half].mean())
            second_half_mean = float(series.iloc[half:].mean())
            change_pct = (
                (second_half_mean - first_half_mean) / abs(first_half_mean) * 100
                if first_half_mean != 0
                else 0.0
            )
            trend = "increasing" if change_pct > 5 else "decreasing" if change_pct < -5 else "stable"
            chart_data = {
                "type": "line",
                "data": [
                    {"index": i, "value": float(v)}
                    for i, v in enumerate(series.reset_index(drop=True))
                ][:200],
            }
            insights.append({
                "id": f"trend_{col}",
                "title": f"Trend: {col} is {trend}",
                "description": (
                    f"'{col}' shows a {trend} trend. "
                    f"First-half average: {first_half_mean:.2f}, "
                    f"second-half average: {second_half_mean:.2f} "
                    f"({change_pct:+.1f}% change)."
                ),
                "insight_type": "trend",
                "confidence": 0.80,
                "chart_data": chart_data,
            })

        # 3. Distribution analysis per numeric column
        for col in numeric_cols[:6]:
            series = df[col].dropna()
            if len(series) < 4:
                continue
            mean_val = float(series.mean())
            std_val = float(series.std())
            skew_val = float(series.skew())
            if abs(skew_val) < 0.5:
                dist_type = "normal"
            elif skew_val > 1.0:
                dist_type = "right-skewed"
            elif skew_val < -1.0:
                dist_type = "left-skewed"
            else:
                dist_type = "moderately skewed"

            # Build histogram data (10 bins)
            counts, bin_edges = np.histogram(series, bins=10)
            chart_data = {
                "type": "bar",
                "data": [
                    {"name": f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}", "value": int(counts[i])}
                    for i in range(len(counts))
                ],
            }
            insights.append({
                "id": f"dist_{col}",
                "title": f"Distribution of {col}: {dist_type}",
                "description": (
                    f"'{col}' has a {dist_type} distribution. "
                    f"Mean: {mean_val:.2f}, Std: {std_val:.2f}, Skewness: {skew_val:.2f}."
                ),
                "insight_type": "distribution",
                "confidence": 0.88,
                "chart_data": chart_data,
            })

        # 4. Top/bottom performing categories (for each categorical col with <= 20 uniques)
        for col in cat_cols[:3]:
            if df[col].nunique() > 20:
                continue
            value_counts = df[col].value_counts()
            top_items = value_counts.head(5).to_dict()
            chart_data = {
                "type": "bar",
                "data": [{"name": str(k), "value": int(v)} for k, v in top_items.items()],
            }
            top_cat = value_counts.idxmax()
            bottom_cat = value_counts.idxmin()
            insights.append({
                "id": f"category_{col}",
                "title": f"Category performance: {col}",
                "description": (
                    f"In '{col}', '{top_cat}' is the most frequent "
                    f"({int(value_counts.max())} occurrences) and '{bottom_cat}' "
                    f"is the least frequent ({int(value_counts.min())} occurrences)."
                ),
                "insight_type": "distribution",
                "confidence": 0.92,
                "chart_data": chart_data,
            })

        # 5. Anomaly detection via Z-score
        for col in numeric_cols[:4]:
            series = df[col].dropna()
            if len(series) < 10:
                continue
            mean_val = float(series.mean())
            std_val = float(series.std())
            if std_val == 0:
                continue
            z_scores = (series - mean_val) / std_val
            anomalies = series[z_scores.abs() > 3]
            if len(anomalies) > 0:
                anomaly_count = len(anomalies)
                chart_data = {
                    "type": "scatter",
                    "data": [{"index": int(i), "value": float(v)} for i, v in anomalies.items()],
                }
                insights.append({
                    "id": f"anomaly_{col}",
                    "title": f"Anomalies detected in {col}",
                    "description": (
                        f"Found {anomaly_count} anomalous value(s) in '{col}' "
                        f"(|Z-score| > 3). Range: [{float(anomalies.min()):.2f}, {float(anomalies.max()):.2f}]. "
                        f"Column mean is {mean_val:.2f}."
                    ),
                    "insight_type": "anomaly",
                    "confidence": 0.82,
                    "chart_data": chart_data,
                })

        key_findings = [ins["title"] for ins in insights[:3]]

        return {
            "insights": insights,
            "key_findings": key_findings,
            "next_questions": [
                "What patterns emerge when grouping by categorical variables?",
                "Are there temporal trends in the data?",
                "How do outliers impact the overall analysis?",
            ],
        }
