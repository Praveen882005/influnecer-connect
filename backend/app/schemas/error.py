from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class ErrorDetailItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    loc: Optional[List[Union[str, int]]] = Field(default=None, description="Location of the field error")
    msg: str = Field(description="Error message")
    type: Optional[str] = Field(default=None, description="Error type code")


class ErrorContent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: int = Field(description="HTTP status code")
    message: str = Field(description="High-level human-readable error description")
    error_type: str = Field(default="api_error", description="Category of error")
    details: Optional[List[ErrorDetailItem]] = Field(default=None, description="Detailed field errors if applicable")


class StandardErrorResponse(BaseModel):
    """Standardized API error envelope conforming to enterprise REST standards."""

    model_config = ConfigDict(from_attributes=True)

    error: ErrorContent
    detail: Optional[Union[str, List[Any]]] = Field(
        default=None,
        description="Backward-compatible detail field for standard FastAPI/OAuth2 clients",
    )
