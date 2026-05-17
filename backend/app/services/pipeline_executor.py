import logging
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class PipelineExecutor:
    """Execute pipeline nodes in topological order using pandas."""

    def __init__(self):
        self.node_results: Dict[str, Dict[str, Any]] = {}
        self.last_output_df: Optional[pd.DataFrame] = None

    def _normalized_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Flatten config payloads coming from frontend model shape."""
        if not isinstance(config, dict):
            return {}

        params = config.get("parameters", {})
        if not isinstance(params, dict):
            params = {}

        merged = dict(params)
        operation = config.get("operation")
        if operation and "operation" not in merged:
            merged["operation"] = operation
        return merged

    def _coerce_filter_value(self, series: pd.Series, value: Any) -> Any:
        if value is None:
            return None

        if pd.api.types.is_numeric_dtype(series):
            try:
                return pd.to_numeric(value)
            except Exception:
                return value

        return value

    async def execute_node(
        self,
        node_id: str,
        node_type: str,
        config: Dict[str, Any],
        input_data: Optional[pd.DataFrame],
    ) -> pd.DataFrame:
        """Execute one node and track status."""
        self.node_results[node_id] = {
            "status": "running",
            "output_rows": 0,
        }

        try:
            if node_type == "source":
                result = await self._execute_source(input_data)
            elif node_type == "filter":
                result = await self._execute_filter(config, input_data)
            elif node_type == "transform":
                result = await self._execute_transform(config, input_data)
            elif node_type == "aggregate":
                result = await self._execute_aggregate(config, input_data)
            elif node_type == "output":
                result = await self._execute_output(input_data)
            else:
                raise ValueError(f"Unsupported node type: {node_type}")

            self.node_results[node_id] = {
                "status": "completed",
                "output_rows": len(result),
            }
            return result
        except Exception as exc:
            self.node_results[node_id] = {
                "status": "failed",
                "error": str(exc),
            }
            raise

    async def _execute_source(self, input_data: Optional[pd.DataFrame]) -> pd.DataFrame:
        if input_data is None:
            raise ValueError("Source node requires input data")
        return input_data.copy()

    async def _execute_filter(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        if input_data is None:
            raise ValueError("Filter node requires input data")

        column = config.get("column")
        condition = config.get("condition", "equals")
        value = config.get("value")

        # Backward compatibility
        if not column:
            column = config.get("filter_column")
        if condition == "equals" and "operator" in config:
            condition = config.get("operator", "equals")

        if not column:
            raise ValueError("Filter requires a column")
        if column not in input_data.columns:
            raise ValueError(f"Filter column '{column}' not found")

        series = input_data[column]
        coerced = self._coerce_filter_value(series, value)

        if condition in {"equals", "=="}:
            mask = series == coerced
        elif condition in {"not_equals", "!="}:
            mask = series != coerced
        elif condition in {"greater_than", ">"}:
            mask = series > coerced
        elif condition in {"less_than", "<"}:
            mask = series < coerced
        elif condition == "contains":
            mask = series.astype(str).str.contains(str(value), case=False, na=False)
        elif condition == "not_null":
            mask = series.notna()
        elif condition == "is_null":
            mask = series.isna()
        else:
            raise ValueError(f"Unsupported filter condition: {condition}")

        return input_data[mask].copy()

    async def _execute_transform(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        if input_data is None:
            raise ValueError("Transform node requires input data")

        result = input_data.copy()
        operation = config.get("operation", "")
        column = config.get("column")

        # Backward compatibility
        if not operation:
            operation = config.get("transform_type", "")

        if operation == "rename_column":
            new_name = config.get("new_name")
            if not column or not new_name:
                raise ValueError("Rename requires source column and new name")
            if column not in result.columns:
                raise ValueError(f"Column '{column}' not found")
            result = result.rename(columns={column: new_name})

        elif operation == "drop_column":
            if not column:
                raise ValueError("Drop column requires a column")
            result = result.drop(columns=[column], errors="ignore")

        elif operation == "fill_nulls_mean":
            if not column:
                raise ValueError("Fill nulls mean requires a column")
            result[column] = pd.to_numeric(result[column], errors="coerce").fillna(
                pd.to_numeric(result[column], errors="coerce").mean()
            )

        elif operation == "fill_nulls_median":
            if not column:
                raise ValueError("Fill nulls median requires a column")
            result[column] = pd.to_numeric(result[column], errors="coerce").fillna(
                pd.to_numeric(result[column], errors="coerce").median()
            )

        elif operation == "fill_nulls_zero":
            if not column:
                raise ValueError("Fill nulls 0 requires a column")
            result[column] = result[column].fillna(0)

        elif operation == "uppercase":
            if not column:
                raise ValueError("Uppercase requires a column")
            result[column] = result[column].astype(str).str.upper()

        elif operation == "lowercase":
            if not column:
                raise ValueError("Lowercase requires a column")
            result[column] = result[column].astype(str).str.lower()

        elif operation in {"", "none"}:
            pass
        else:
            raise ValueError(f"Unsupported transform operation: {operation}")

        return result

    async def _execute_aggregate(
        self, config: Dict[str, Any], input_data: Optional[pd.DataFrame]
    ) -> pd.DataFrame:
        if input_data is None:
            raise ValueError("Aggregate node requires input data")

        group_by = config.get("group_by")
        aggregations = config.get("aggregations", {})

        if not group_by:
            raise ValueError("Aggregate requires a group_by column")
        if group_by not in input_data.columns:
            raise ValueError(f"Group-by column '{group_by}' not found")

        if not isinstance(aggregations, dict):
            raise ValueError("Aggregate config must include aggregations map")

        valid_aggs = {"sum", "mean", "count", "min", "max"}
        cleaned_aggregations: Dict[str, str] = {}
        for col, agg in aggregations.items():
            if col not in input_data.columns:
                continue
            agg_name = str(agg).lower()
            if agg_name not in valid_aggs:
                raise ValueError(f"Unsupported aggregation '{agg_name}' for column '{col}'")
            cleaned_aggregations[col] = agg_name

        if not cleaned_aggregations:
            grouped = input_data.groupby(group_by, dropna=False).size().reset_index(name="count")
            return grouped

        return (
            input_data.groupby(group_by, dropna=False)
            .agg(cleaned_aggregations)
            .reset_index()
        )

    async def _execute_output(self, input_data: Optional[pd.DataFrame]) -> pd.DataFrame:
        if input_data is None:
            raise ValueError("Output node requires input data")
        return input_data.copy()

    def _topological_order(
        self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
    ) -> List[str]:
        node_ids = {node["id"] for node in nodes}
        indegree = {node_id: 0 for node_id in node_ids}
        graph: Dict[str, List[str]] = defaultdict(list)

        for edge in edges:
            src = edge.get("source")
            dst = edge.get("target")
            if src not in node_ids or dst not in node_ids:
                continue
            graph[src].append(dst)
            indegree[dst] += 1

        queue: deque[str] = deque(sorted([n for n, d in indegree.items() if d == 0]))
        ordered: List[str] = []

        while queue:
            node_id = queue.popleft()
            ordered.append(node_id)
            for nxt in graph[node_id]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    queue.append(nxt)

        if len(ordered) != len(node_ids):
            raise ValueError("Pipeline graph contains a cycle")

        return ordered

    async def execute_pipeline(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        input_data: pd.DataFrame,
    ) -> Dict[str, Any]:
        self.node_results = {}
        self.last_output_df = None

        try:
            if not nodes:
                raise ValueError("Pipeline has no nodes")

            node_map = {node["id"]: node for node in nodes}
            ordered_ids = self._topological_order(nodes, edges)

            incoming_map: Dict[str, List[str]] = defaultdict(list)
            for edge in edges:
                src = edge.get("source")
                dst = edge.get("target")
                if src in node_map and dst in node_map:
                    incoming_map[dst].append(src)

            data_by_node: Dict[str, pd.DataFrame] = {}
            original_count = len(input_data)

            for node_id in ordered_ids:
                node = node_map[node_id]
                node_type = str(node.get("type", "")).lower()
                config = self._normalized_config(node.get("config", {}))

                if node_type == "source":
                    node_input = input_data
                else:
                    parents = incoming_map.get(node_id, [])
                    if not parents:
                        raise ValueError(f"Node '{node_id}' has no input")
                    node_input = data_by_node[parents[-1]]

                node_output = await self.execute_node(node_id, node_type, config, node_input)
                data_by_node[node_id] = node_output

            output_node_ids = [
                node_id
                for node_id in ordered_ids
                if str(node_map[node_id].get("type", "")).lower() == "output"
            ]
            final_node_id = output_node_ids[-1] if output_node_ids else ordered_ids[-1]
            final_df = data_by_node[final_node_id].replace({np.nan: None})
            self.last_output_df = final_df.copy()

            return {
                "success": True,
                "status": "completed",
                "rows_before": original_count,
                "rows_after": len(final_df),
                "row_count": len(final_df),
                "preview": final_df.head(20).to_dict("records"),
                "output_data": final_df.head(200).to_dict("records"),
                "columns": [str(c) for c in final_df.columns],
                "node_results": self.node_results,
            }

        except Exception as exc:
            logger.error(f"Pipeline execution failed: {exc}")
            return {
                "success": False,
                "status": "failed",
                "error": str(exc),
                "node_results": self.node_results,
            }
