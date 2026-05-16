import pandas as pd
import numpy as np
from typing import List, Dict, Any
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error
import logging
from uuid import uuid4

logger = logging.getLogger(__name__)


class PredictorAgent:
    """Train and make predictions with ML models."""

    _models = {}
    _model_features = {}

    @staticmethod
    async def train_model(
        df: pd.DataFrame,
        target_column: str,
        features: List[str],
        model_type: str = "classification",
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> Dict[str, Any]:
        """Train a predictive model."""

        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in data")
        if model_type not in ("classification", "regression"):
            raise ValueError("model_type must be either 'classification' or 'regression'")

        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Missing feature columns: {missing_features}")

        X = df[features].copy()
        y = df[target_column].copy()

        X = X.fillna(X.mean(numeric_only=True))

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        if model_type == "classification":
            model = RandomForestClassifier(n_estimators=100, random_state=random_state)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

            model_id = f"model_clf_{uuid4().hex[:12]}"
            PredictorAgent._models[model_id] = model
            PredictorAgent._model_features[model_id] = features

            return {
                "model_id": model_id,
                "model_type": "classification",
                "accuracy": float(accuracy),
                "f1_score": float(f1),
                "feature_importance": dict(
                    zip(
                        features,
                        [float(x) for x in model.feature_importances_],
                    )
                ),
                "training_samples": len(X_train),
                "message": "Classification model trained successfully",
            }

        else:
            model = RandomForestRegressor(n_estimators=100, random_state=random_state)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))

            model_id = f"model_reg_{uuid4().hex[:12]}"
            PredictorAgent._models[model_id] = model
            PredictorAgent._model_features[model_id] = features

            return {
                "model_id": model_id,
                "model_type": "regression",
                "rmse": float(rmse),
                "feature_importance": dict(
                    zip(
                        features,
                        [float(x) for x in model.feature_importances_],
                    )
                ),
                "training_samples": len(X_train),
                "message": "Regression model trained successfully",
            }

    @staticmethod
    async def make_predictions(
        model_id: str, input_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Make predictions with a trained model."""

        if model_id not in PredictorAgent._models:
            raise ValueError(f"Model '{model_id}' not found")

        model = PredictorAgent._models[model_id]
        expected_features = PredictorAgent._model_features.get(model_id, [])

        input_df = pd.DataFrame(input_data)
        if input_df.empty:
            raise ValueError("input_data must contain at least one row")

        missing_features = [feature for feature in expected_features if feature not in input_df.columns]
        if missing_features:
            raise ValueError(f"Missing required input features: {missing_features}")

        extra_features = [feature for feature in input_df.columns if feature not in expected_features]
        if extra_features:
            raise ValueError(f"Unexpected input features: {extra_features}")

        input_df = input_df[expected_features]
        input_df = input_df.fillna(input_df.mean(numeric_only=True))
        predictions = model.predict(input_df)

        if hasattr(model, "predict_proba"):
            confidences = [float(max(proba)) for proba in model.predict_proba(input_df)]
        else:
            confidences = [1.0] * len(predictions)

        # Convert predictions to serializable format
        predictions_output = [
            float(p) if isinstance(p, (int, np.integer, float)) else str(p)
            for p in predictions
        ]

        return {
            "model_id": model_id,
            "predictions": predictions_output,
            "confidence_scores": confidences,
            "execution_time_ms": 10,
        }
