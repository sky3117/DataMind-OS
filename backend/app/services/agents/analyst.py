import pandas as pd
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class AnalystAgent:
    """Generate insights and analysis from data."""

    @staticmethod
    async def generate_insights(df: pd.DataFrame) -> Dict[str, Any]:
        """Generate insights from the dataframe."""
        insights = []

        numeric_cols = df.select_dtypes(include=['float64', 'int64']).columns

        for col in numeric_cols:
            if len(df[col]) > 0:
                mean = df[col].mean()
                std = df[col].std()
                min_val = df[col].min()
                max_val = df[col].max()

                if std > 0:
                    insights.append({
                        "id": f"distribution_{col}",
                        "title": f"Distribution Analysis: {col}",
                        "description": f"The column {col} has a mean of {mean:.2f} with standard deviation of {std:.2f}",
                        "insight_type": "distribution",
                        "confidence": 0.92,
                        "supporting_data": {
                            "mean": float(mean),
                            "std": float(std),
                            "min": float(min_val),
                            "max": float(max_val),
                        },
                        "visualization_type": "line",
                    })

                if max_val - min_val > mean * 2:
                    insights.append({
                        "id": f"anomaly_{col}",
                        "title": f"High Variance Detected: {col}",
                        "description": f"Column {col} shows high variance relative to its mean",
                        "insight_type": "anomaly",
                        "confidence": 0.78,
                        "supporting_data": {"range": float(max_val - min_val), "mean": float(mean)},
                        "visualization_type": "scatter",
                    })

        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            high_corr_pairs = []

            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if abs(corr_val) > 0.7:
                        col1 = corr_matrix.columns[i]
                        col2 = corr_matrix.columns[j]
                        high_corr_pairs.append((col1, col2, corr_val))
                        insights.append({
                            "id": f"corr_{col1}_{col2}",
                            "title": f"Correlation Found: {col1} ↔ {col2}",
                            "description": f"Strong correlation ({corr_val:.2f}) between {col1} and {col2}",
                            "insight_type": "correlation",
                            "confidence": 0.88,
                            "supporting_data": {
                                "column1": col1,
                                "column2": col2,
                                "correlation": float(corr_val),
                            },
                            "visualization_type": "heatmap",
                        })

        key_findings = []
        for insight in insights[:3]:
            key_findings.append(insight["title"])

        return {
            "insights": insights,
            "key_findings": key_findings,
            "next_questions": [
                "What patterns emerge when grouping by categorical variables?",
                "Are there temporal trends in the data?",
                "How do outliers impact the analysis?",
            ],
        }
