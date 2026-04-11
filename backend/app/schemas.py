from pydantic import BaseModel
from typing import Literal, Optional


class AssetCreate(BaseModel):
    name: str
    asset_type: Literal["host", "domain", "website"]
    asset_value: str


class AssetResponse(BaseModel):
    id: int
    name: str
    asset_type: str
    asset_value: str
    status: str

    class Config:
        from_attributes = True


class AssetCheckUpsert(BaseModel):
    check_type: Literal["ports", "email", "tls"]
    enabled: bool
    frequency: Optional[Literal["1min", "15min", "1hour", "6hours", "daily"]] = None


class AssetChecksSaveRequest(BaseModel):
    checks: list[AssetCheckUpsert]
