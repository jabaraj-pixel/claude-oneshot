from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall health status: ok, degraded, or unhealthy")
    timestamp: datetime = Field(..., description="UTC timestamp of the health check")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Runtime environment")
    database: Dict[str, Any] = Field(..., description="Database connectivity status")
    integrations: Dict[str, bool] = Field(
        ...,
        description="Configuration status of external third-party integrations",
    )


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error description")
    details: Optional[Any] = Field(None, description="Additional context or validation details")


class StandardErrorResponse(BaseModel):
    error: ErrorDetail
    timestamp: datetime
    request_id: str

