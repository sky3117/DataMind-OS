import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class PipelineExecutor:
    """Execute pipeline nodes in sequence using pandas."""

    def __init__(self):
        self.execution_state: Dict[str, Any] = {}
        self.node_results: Dict[str, Dict[str, Any]] = {}

    async def execute_node(
        self,
        node_id: str,
        node_type: str,
        config: Dict[str, Any],
        input_data: Optional[pd.DataFrame] = None,
    ) -> pd.DataFrame:
        """Execute a single pipeline node."""
        try:
            self.node_results[node_id] = {
                "status": "running",
                "output_rows": 0,
            }

            if node_type == "source":
                result = await self._execute_source(config, input_data)
            elif node_type == "filter":
                result = await self._execute_filter(config, input_data)
            elif node_type == "transform":
                result = await self._execute_transform(config, input_data)
            elif node_type == "aggregate":
                result = await self._execute_aggregate(config, input_data)
            elif node_type == "join":
                result = await self._execute_join(config, input_data)
            elif node_type == "ai_transform":
                result = await self._execute_ai_transform(config, input_data)
            elif node_type == "output":
                result = await self._execute_output(config, input_data)
            else:
                raise ValueError(f"Unknown node type: {node_type}")

            self.node_results[node_id] = {
                "status": "completed",
                "output_rows": len(result) if result is not None else 0,
            }
            return result

        except Exception as e:
            logger.error(f"Error executing node {node_id}: {str(e)}")
            self.node_results[node_id] = {
                "status": "failed",
                "error": str(e),
            }
            raise

    async def _execute_source(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """Source node: returns the initial data."""
        if input_data is None:
            raise ValueError("Source node requires input data")
        return input_data.copy()

    async def _execute_filter(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """Filter node: filter rows based on conditions."""
        if input_data is None:
            raise ValueError("Filter node requires input data")

        column = config.get("column")
        operator = config.get("operator", "==")
        value = config.get("value")

        if not column:
            raise ValueError("Filter requires 'column' parameter")

        if operator == "==":
            return input_data[input_data[column] == value].copy()
        elif operator == "!=":
            return input_data[input_data[column] != value].copy()
        elif operator == ">":
            return input_data[input_data[column] > value].copy()
        elif operator == "<":
            return input_data[input_data[column] < value].copy()
        elif operator == ">=":
            return input_data[input_data[column] >= value].copy()
        elif operator == "<=":
            return input_data[input_data[column] <= value].copy()
        elif operator == "in":
            return input_data[input_data[column].isin(value)].copy()
        else:
            raise ValueError(f"Unknown operator: {operator}")

    async def _execute_transform(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """Transform node: apply transformations to columns."""
        if input_data is None:
            raise ValueError("Transform node requires input data")

        result = input_data.copy()
        operation = config.get("operation", "none")

        if operation == "drop_columns":
            columns = config.get("columns", [])
            result = result.drop(columns=columns, errors="ignore")
        elif operation == "rename":
            mapping = config.get("mapping", {})
            result = result.rename(columns=mapping)
        elif operation == "fillna":
            column = config.get("column")
            fill_value = config.get("fill_value", 0)
            if column:
                result[column] = result[column].fillna(fill_value)
            else:
                result = result.fillna(fill_value)
        elif operation == "type_cast":
            column = config.get("column")
            dtype = config.get("dtype", "str")
            if column:
                result[column] = result[column].astype(dtype)
        elif operation == "normalize":
            column = config.get("column")
            if column:
                min_val = result[column].min()
                max_val = result[column].max()
                result[column] = (result[column] - min_val) / (max_val - min_val)

        return result

    async def _execute_aggregate(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """Aggregate node: group and aggregate data."""
        if input_data is None:
            raise ValueError("Aggregate node requires input data")

        group_by = config.get("group_by", [])
        aggregations = config.get("aggregations", {})

        if not group_by:
            raise ValueError("Aggregate requires 'group_by' parameter")

        result = input_data.groupby(group_by, as_index=False).agg(aggregations)
        return result

    async def _execute_join(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """Join node: join with another dataset."""
        if input_data is None:
            raise ValueError("Join node requires input data")

        on = config.get("on")
        how = config.get("how", "inner")

        if not on:
            raise ValueError("Join requires 'on' parameter")

        logger.warning("Join operation not fully implemented in executor")
        return input_data.copy()

    async def _execute_ai_transform(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """AI Transform node: apply AI-based transformations."""
        if input_data is None:
            raise ValueError("AI Transform node requires input data")

        logger.warning("AI Transform operation not fully implemented")
        return input_data.copy()

    async def _execute_output(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        """Output node: return processed data."""
        if input_data is None:
            raise ValueError("Output node requires input data")
        return input_data.copy()

    async def execute_pipeline(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        input_data: pd.DataFrame,
    ) -> Dict[str, Any]:
        """Execute full pipeline."""
        self.execution_state = {}
        self.node_results = {}

        try:
            node_map = {node["id"]: node for node in nodes}
            current_data = input_data.copy()

            for node in nodes:
                node_id = node["id"]
                node_type = node["type"]
                config = node.get("config", {})

                current_data = await self.execute_node(
                    node_id, node_type, config, current_data
                )

            return {
                "status": "completed",
                "output_data": current_data.to_dict("records"),
                "row_count": len(current_data),
                "node_results": self.node_results,
            }

        except Exception as e:
            logger.error(f"Pipeline execution failed: {str(e)}")
            return {
                "status": "failed",
                "error": str(e),
                "node_results": self.node_results,
            }
