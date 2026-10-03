"""
Weather rating for each launch window, from the free Open-Meteo forecast API (no key needed).

Rates every hour of the next 16 days as:
    green  = GO       (calm, dry, no storms)
    yellow = CAUTION  (gusty, some rain chance or heavy cloud)
    red    = NO-GO    (strong gusts, likely rain or thunderstorms)

If the forecast can't be fetched, every window is rated yellow ("can't confirm").
"""
import time
from datetime import timezone

import requests

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_SECONDS = 30 * 60  # forecasts only change hourly; avoid re-fetching on every click

_cache = {}  # (lat, lon) -> (fetched_at, {"YYYY-MM-DDTHH:00": rating})


def _rate_hour(gust_kmh, rain_chance, cloud_pct, weather_code):
    gust_kmh = gust_kmh or 0
    rain_chance = rain_chance or 0
    cloud_pct = cloud_pct or 0
    weather_code = weather_code or 0

    # Thunderstorm codes are 95–99 in the WMO scheme Open-Meteo uses
    if weather_code >= 95 or gust_kmh > 55 or rain_chance > 60:
        return "red"
    if gust_kmh > 35 or rain_chance > 30 or cloud_pct > 85:
        return "yellow"
    return "green"


def _hourly_ratings(lat, lon):
    key = (round(lat, 3), round(lon, 3))
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]

    response = requests.get(
        FORECAST_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "wind_gusts_10m,precipitation_probability,cloud_cover,weather_code",
            "forecast_days": 16,
            "timezone": "UTC",
        },
        timeout=8,
    )
    response.raise_for_status()
    hourly = response.json()["hourly"]

    ratings = {
        hour: _rate_hour(gust, rain, cloud, code)
        for hour, gust, rain, cloud, code in zip(
            hourly["time"],
            hourly["wind_gusts_10m"],
            hourly["precipitation_probability"],
            hourly["cloud_cover"],
            hourly["weather_code"],
        )
    }
    _cache[key] = (time.time(), ratings)
    return ratings


def rate_windows(lat, lon, start_times):
    """Return one rating per start time (timezone-aware datetimes)."""
    try:
        ratings = _hourly_ratings(lat, lon)
    except Exception as error:  # network down, API error, bad response…
        print(f"[weather] forecast unavailable, rating all windows yellow: {error}")
        return ["yellow"] * len(start_times)

    return [
        ratings.get(t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00"), "yellow")
        for t in start_times
    ]
