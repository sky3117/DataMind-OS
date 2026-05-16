import pandas as pd
import numpy as np
from typing import List, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class CleanerAgent:
    """Data cleaning suggestions and automated cleaning."""

    @staticmethod
    async def analyze_data(df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data quality and suggest cleaning actions."""
        suggestions = []
        total_rows = len(df)

        # Check for row-level duplicates once
        dup_row_count = int(df.duplicated().sum())
        if dup_row_count > 0:
            dup_pct = (dup_row_count / total_rows) * 100
            suggestions.append({
                "id": "duplicates_rows",
                "column": "(all columns)",
                "issue_type": "duplicates",
                "description": f"Dataset has {dup_row_count} duplicate rows ({dup_pct:.1f}%)",
                "severity": "high" if dup_pct > 20 else "medium",
                "suggested_action": "Remove duplicate rows",
                "affected_rows": dup_row_count,
                "confidence": 0.99,
            })

        for col in df.columns:
            null_count = int(df[col].isnull().sum())
            null_pct = (null_count / total_rows) * 100

            if null_count > 0:
                is_numeric = pd.api.types.is_numeric_dtype(df[col])
                if is_numeric:
                    action = "Fill with mean/median or drop rows"
                else:
                    action = "Fill with mode or forward fill"
                suggestions.append({
                    "id": f"missing_{col}",
                    "column": col,
                    "issue_type": "missing_values",
                    "description": f"Column '{col}' has {null_count} missing values ({null_pct:.1f}%)",
                    "severity": "high" if null_pct > 50 else "medium" if null_pct > 10 else "low",
                    "suggested_action": action,
                    "affected_rows": null_count,
                    "confidence": 0.95,
                })

            # Outlier detection only for numeric columns
            if pd.api.types.is_numeric_dtype(df[col]) and df[col].notna().sum() > 3:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                if IQR > 0:
                    lower = Q1 - 1.5 * IQR
                    upper = Q3 + 1.5 * IQR
                    outlier_mask = (df[col] < lower) | (df[col] > upper)
                    outlier_count = int(outlier_mask.sum())
                    if outlier_count > 0:
                        out_pct = (outlier_count / total_rows) * 100
                        suggestions.append({
                            "id": f"outliers_{col}",
                            "column": col,
                            "issue_type": "outliers",
                            "description": f"Column '{col}' has {outlier_count} outliers ({out_pct:.1f}%) outside IQR bounds [{lower:.2f}, {upper:.2f}]",
                            "severity": "medium" if out_pct > 10 else "low",
                            "suggested_action": f"Remove or cap outliers in '{col}'",
                            "affected_rows": outlier_count,
                            "confidence": 0.85,
                        })

            # Inconsistent format check for object columns
            if df[col].dtype == object and df[col].notna().sum() > 0:
                sample = df[col].dropna().astype(str)
                has_mixed_case = (
                    sample.str.lower() != sample
                ).any() and (sample.str.upper() != sample).any()
                has_leading_spaces = sample.str.strip() != sample
                if has_leading_spaces.any():
                    suggestions.append({
                        "id": f"format_{col}",
                        "column": col,
                        "issue_type": "inconsistent_format",
                        "description": f"Column '{col}' has values with leading/trailing whitespace",
                        "severity": "low",
                        "suggested_action": f"Strip whitespace from '{col}'",
                        "affected_rows": int(has_leading_spaces.sum()),
                        "confidence": 0.90,
                    })

        # Health score: start at 100 and penalise by issue severity
        penalty = 0
        for s in suggestions:
            if s["severity"] == "high":
                penalty += 15
            elif s["severity"] == "medium":
                penalty += 8
            else:
                penalty += 3
        overall_health = max(0, 100 - penalty)

        return {
            "suggestions": suggestions,
            "overall_health_score": overall_health,
            "recommended_actions": [s["suggested_action"] for s in suggestions[:5]],
        }

    @staticmethod
    async def apply_fix(
        df: pd.DataFrame,
        suggestion_id: str,
        action: str,
        file_dir: Path,
        file_path: Path,
    ) -> Dict[str, Any]:
        """Apply a single fix identified by suggestion_id with the given action.

        Returns a dict with success, before_rows, after_rows, cleaned_file_id.
        The cleaned dataframe is saved back to file_path.
        """
        before_rows = len(df)
        result_df = df.copy()

        # Parse suggestion_id to determine what to do
        if suggestion_id == "duplicates_rows":
            result_df = result_df.drop_duplicates()
        elif suggestion_id.startswith("missing_"):
            col = suggestion_id[len("missing_"):]
            if col not in result_df.columns:
                raise ValueError(f"Column '{col}' not found in dataframe")
            if action == "mean":
                if pd.api.types.is_numeric_dtype(result_df[col]):
                    result_df[col] = result_df[col].fillna(result_df[col].mean())
                else:
                    raise ValueError(f"Cannot apply mean to non-numeric column '{col}'")
            elif action == "median":
                if pd.api.types.is_numeric_dtype(result_df[col]):
                    result_df[col] = result_df[col].fillna(result_df[col].median())
                else:
                    raise ValueError(f"Cannot apply median to non-numeric column '{col}'")
            elif action == "mode":
                modes = result_df[col].mode()
                if len(modes) > 0:
                    result_df[col] = result_df[col].fillna(modes[0])
            elif action == "ffill":
                result_df[col] = result_df[col].ffill()
            elif action == "drop":
                result_df = result_df.dropna(subset=[col])
            else:
                raise ValueError(f"Unknown action '{action}' for missing values")
        elif suggestion_id.startswith("outliers_"):
            col = suggestion_id[len("outliers_"):]
            if col not in result_df.columns:
                raise ValueError(f"Column '{col}' not found in dataframe")
            if not pd.api.types.is_numeric_dtype(result_df[col]):
                raise ValueError(f"Cannot handle outliers in non-numeric column '{col}'")
            Q1 = result_df[col].quantile(0.25)
            Q3 = result_df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            if action == "drop":
                result_df = result_df[(result_df[col] >= lower) & (result_df[col] <= upper)]
            elif action == "cap":
                result_df[col] = result_df[col].clip(lower=lower, upper=upper)
            # 'keep' → do nothing
        elif suggestion_id.startswith("format_"):
            col = suggestion_id[len("format_"):]
            if col not in result_df.columns:
                raise ValueError(f"Column '{col}' not found in dataframe")
            if result_df[col].dtype == object:
                result_df[col] = result_df[col].str.strip()
        elif suggestion_id.startswith("duplicates_"):
            col = suggestion_id[len("duplicates_"):]
            if col in result_df.columns:
                result_df = result_df.drop_duplicates(subset=[col])
        else:
            raise ValueError(f"Unknown suggestion_id: '{suggestion_id}'")

        after_rows = len(result_df)

        # Save back to the original file (overwrite)
        ext = file_path.suffix.lower()
        if ext == ".csv":
            result_df.to_csv(file_path, index=False)
        elif ext in [".xlsx", ".xls"]:
            result_df.to_excel(file_path, index=False)
        else:
            result_df.to_csv(file_path, index=False)

        # cleaned_file_id is the same directory (same file_id)
        cleaned_file_id = file_dir.name

        return {
            "success": True,
            "before_rows": before_rows,
            "after_rows": after_rows,
            "cleaned_file_id": cleaned_file_id,
        }

    @staticmethod
    async def apply_cleaning(
        df: pd.DataFrame, actions: List[str], auto_fix: bool = False
    ) -> Dict[str, Any]:
        """Legacy: Apply cleaning actions to dataframe (bulk)."""
        result_df = df.copy()
        rows_affected = 0

        if auto_fix:
            for col in result_df.columns:
                null_count = result_df[col].isnull().sum()
                if null_count > 0:
                    if pd.api.types.is_numeric_dtype(result_df[col]):
                        result_df[col] = result_df[col].fillna(result_df[col].mean())
                    else:
                        mode_values = result_df[col].mode()
                        if len(mode_values) > 0:
                            result_df[col] = result_df[col].fillna(mode_values[0])
                    rows_affected += int(null_count)

            result_df = result_df.drop_duplicates()

        return {
            "actions_applied": actions,
            "rows_affected": rows_affected,
            "new_health_score": 85,
        }
