import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional, Tuple
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.preprocessing import LabelEncoder
import logging
from uuid import uuid4

logger = logging.getLogger(__name__)


class PredictorAgent:
    """Train and make predictions with ML models."""

    _models: Dict[str, Any] = {}
    _model_features: Dict[str, List[str]] = {}
    _model_types: Dict[str, str] = {}
    _label_encoders: Dict[str, Dict[str, LabelEncoder]] = {}

    @staticmethod
    def _prepare_features(
        df: pd.DataFrame, feature_cols: List[str]
    ) -> Tuple[pd.DataFrame, Dict[str, LabelEncoder]]:
        """Encode categoricals and fill missing values."""
        X = df[feature_cols].copy()
        encoders: Dict[str, LabelEncoder] = {}
        for col in X.columns:
            if X[col].dtype == object or str(X[col].dtype) == "category":
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str).fillna("__missing__"))
                encoders[col] = le
            else:
                X[col] = X[col].fillna(X[col].median())
        return X, encoders

    @staticmethod
    def _apply_encoders(
        df: pd.DataFrame,
        feature_cols: List[str],
        encoders: Dict[str, LabelEncoder],
    ) -> pd.DataFrame:
        """Apply previously fitted encoders."""
        X = df[feature_cols].copy()
        for col in X.columns:
            if col in encoders:
                le = encoders[col]
                vals = X[col].astype(str).fillna("__missing__")
                # Handle unseen labels
                known = set(le.classes_)
                vals = vals.apply(lambda v: v if v in known else le.classes_[0])
                X[col] = le.transform(vals)
            else:
                X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)
        return X

    @staticmethod
    async def get_columns(df: pd.DataFrame) -> List[str]:
        """Return column names from the dataframe."""
        return df.columns.tolist()

    @staticmethod
    async def train_model(
        df: pd.DataFrame,
        target_column: str,
        model_type: str = "random_forest",
        test_size: float = 0.2,
        random_state: int = 42,
        features: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Train a predictive model.

        model_type: 'linear_regression' or 'random_forest'
        """
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in data")
        if model_type not in ("linear_regression", "random_forest"):
            raise ValueError("model_type must be 'linear_regression' or 'random_forest'")

        # Default features: all columns except target
        if not features:
            features = [c for c in df.columns if c != target_column]
        else:
            missing = [f for f in features if f not in df.columns]
            if missing:
                raise ValueError(f"Missing feature columns: {missing}")

        # Prepare target: encode if categorical
        y_raw = df[target_column].copy()
        target_encoder: Optional[LabelEncoder] = None
        if y_raw.dtype == object or str(y_raw.dtype) == "category":
            target_encoder = LabelEncoder()
            y = pd.Series(
                target_encoder.fit_transform(y_raw.astype(str).fillna("__missing__")),
                index=y_raw.index,
            )
        else:
            y = y_raw.fillna(y_raw.median())

        X, encoders = PredictorAgent._prepare_features(df, features)

        # Drop rows where X or y is NaN after encoding
        valid_mask = X.notna().all(axis=1) & y.notna()
        X = X[valid_mask]
        y = y[valid_mask]

        if len(X) < 4:
            raise ValueError("Not enough valid rows to train a model (need at least 4)")

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        if model_type == "linear_regression":
            model = LinearRegression()
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            r2 = float(r2_score(y_test, y_pred))
            accuracy = max(0.0, r2)  # R² as accuracy proxy
            # Linear regression: feature importance via abs coefficients
            coefs = np.abs(model.coef_)
            coef_sum = coefs.sum() or 1.0
            feature_importance = {
                feat: float(c / coef_sum)
                for feat, c in zip(features, coefs)
            }
        else:
            model = RandomForestRegressor(
                n_estimators=100, random_state=random_state, n_jobs=-1
            )
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            r2 = float(r2_score(y_test, y_pred))
            accuracy = max(0.0, r2)
            feature_importance = {
                feat: float(imp)
                for feat, imp in zip(features, model.feature_importances_)
            }

        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

        model_id = f"model_{model_type}_{uuid4().hex[:12]}"
        PredictorAgent._models[model_id] = model
        PredictorAgent._model_features[model_id] = features
        PredictorAgent._model_types[model_id] = model_type
        PredictorAgent._label_encoders[model_id] = encoders

        return {
            "model_id": model_id,
            "model_type": model_type,
            "accuracy": round(accuracy, 4),
            "r2_score": round(r2, 4),
            "rmse": round(rmse, 4),
            "feature_importance": feature_importance,
            "columns_used": features,
            "training_samples": len(X_train),
            "message": f"{model_type.replace('_', ' ').title()} trained successfully",
        }

    @staticmethod
    async def make_predictions(
        model_id: str,
        input_values: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Make a single prediction given a dict of feature values."""
        if model_id not in PredictorAgent._models:
            raise ValueError(f"Model '{model_id}' not found. Please train first.")

        model = PredictorAgent._models[model_id]
        features = PredictorAgent._model_features[model_id]
        encoders = PredictorAgent._label_encoders.get(model_id, {})

        # Build a single-row dataframe
        row = {feat: [input_values.get(feat, np.nan)] for feat in features}
        input_df = pd.DataFrame(row)
        input_df = PredictorAgent._apply_encoders(input_df, features, encoders)

        prediction = float(model.predict(input_df)[0])

        # Confidence interval via std of tree predictions (random forest only)
        confidence_interval: Optional[List[float]] = None
        if hasattr(model, "estimators_"):
            tree_preds = np.array(
                [tree.predict(input_df)[0] for tree in model.estimators_]
            )
            ci_lower = float(np.percentile(tree_preds, 5))
            ci_upper = float(np.percentile(tree_preds, 95))
            confidence_interval = [ci_lower, ci_upper]
        else:
            # For linear regression: use a ±10% heuristic
            margin = abs(prediction) * 0.10
            confidence_interval = [prediction - margin, prediction + margin]

        return {
            "model_id": model_id,
            "prediction": round(prediction, 4),
            "confidence_interval": [
                round(confidence_interval[0], 4),
                round(confidence_interval[1], 4),
            ],
        }
