"""Campaign Forecasting & Outcome Scenario Service Package."""
from app.services.forecasting.campaign_forecaster import (
    CampaignForecaster,
    campaign_forecaster,
)

__all__ = ["CampaignForecaster", "campaign_forecaster"]
