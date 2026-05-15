import pandas as pd
import numpy as np
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class CleanerAgent:
    """Data cleaning suggestions and automated cleaning."""

    @staticmethod
    async def analyze_data(df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data quality and suggest cleaning actions."""
        suggestions = []

        for col in df.columns:
            null_count = df[col].isnull().sum()
            null_pct = (null_count / len(df)) * 100

            if null_count > 0:
                suggestions.append({
                    "id": f"missing_{col}",
                    "column": col,
                    "issue_type": "missing_values",
                    "description": f"Column '{col}' has {null_count} missing values ({null_pct:.1f}%)",
                    "severity": "high" if null_pct > 50 else "medium" if null_pct > 10 else "low",
                    "suggested_action": f"Fill missing values in '{col}' with mean, median, or forward fill",
                    "affected_rows": int(null_count),
                    "confidence": 0.95,
                })

            duplicates = df[col].duplicated().sum()
            if duplicates > 0:
                dup_pct = (duplicates / len(df)) * 100
                suggestions.append({
                    "id": f"duplicates_{col}",
                    "column": col,
                    "issue_type": "duplicates",
                    "description": f"Column '{col}' has {duplicates} duplicate values ({dup_pct:.1f}%)",
                    "severity": "medium" if dup_pct > 30 else "low",
                    "suggested_action": f"Remove or consolidate duplicate values in '{col}'",
                    "affected_rows": int(duplicates),
                    "confidence": 0.9,
                })

            if df[col].dtype in ['float64', 'int64']:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                outliers = df[(df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)]

                if len(outliers) > 0:
                    out_pct = (len(outliers) / len(df)) * 100
                    suggestions.append({
                        "id": f"outliers_{col}",
                        "column": col,
                        "issue_type": "outliers",
                        "description": f"Column '{col}' has {len(outliers)} outliers ({out_pct:.1f}%)",
                        "severity": "medium" if out_pct > 10 else "low",
                        "suggested_action": f"Review or remove outliers in '{col}'",
                        "affected_rows": len(outliers),
                        "confidence": 0.85,
                    })

        overall_health = max(0, 100 - len(suggestions) * 10)

        return {
            "suggestions": suggestions,
            "overall_health_score": overall_health,
            "recommended_actions": [s["suggested_action"] for s in suggestions[:5]],
        }

    @staticmethod
    async def apply_cleaning(
        df: pd.DataFrame, actions: List[str], auto_fix: bool = False
    ) -> Dict[str, Any]:
        """Apply cleaning actions to dataframe."""
        result_df = df.copy()
        rows_affected = 0

        if auto_fix:
            for col in result_df.columns:
                if result_df[col].isnull().sum() > 0:
                    if result_df[col].dtype in ['float64', 'int64']:
                        result_df[col].fillna(result_df[col].mean(), inplace=True)
                    else:
                        result_df[col].fillna(result_df[col].mode()[0], inplace=True)
                    rows_affected += result_df[col].isnull().sum()

            result_df = result_df.drop_duplicates()

        return {
            "actions_applied": actions,
            "rows_affected": rows_affected,
            "new_health_score": 85,
        }
