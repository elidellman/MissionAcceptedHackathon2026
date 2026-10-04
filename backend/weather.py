"""
Weather rating for each launch window, from the free Open-Meteo forecast API.

Rates every hour of the next 16 days and provides:
    green  = GO       (calm, dry, no storms)
    yellow = CAUTION  (gusty, some rain chance or heavy cloud)
    red    = NO-GO    (strong gusts, likely rain or thunderstorms)

Each rating also includes a description and the forecast values
used to determine the rating.
"""
import time
from datetime import timezone

import requests

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_SECONDS = 30 * 60  # forecasts only change hourly; avoid re-fetching on every click

_cache = {}  # (lat, lon) -> (fetched_at, {"YYYY-MM-DDTHH:00": rating})


def _rate_hour(gust_kmh, rain_chance, cloud_pct, weather_code, temperature_c):
    gust_kmh = gust_kmh or 0
    rain_chance = rain_chance or 0
    cloud_pct = cloud_pct or 0
    weather_code = weather_code or 0
    temperature_c = temperature_c if temperature_c is not None else 20

    reasons = []

    # Thunderstorms
    if weather_code >= 95:
        reasons.append("Thunderstorm risk")

    # Wind
    if gust_kmh > 55:
        reasons.append(f"Strong wind gusts up to {round(gust_kmh)} km/h")
    elif gust_kmh > 35:
        reasons.append(f"Moderate wind gusts up to {round(gust_kmh)} km/h")

    # Rain
    if rain_chance > 60:
        reasons.append(f"High chance of rain ({round(rain_chance)}%)")
    elif rain_chance > 30:
        reasons.append(f"Chance of rain ({round(rain_chance)}%)")

    # Clouds
    if cloud_pct > 85:
        reasons.append(f"Heavy cloud cover ({round(cloud_pct)}%)")

    # Temperature
    if temperature_c < 0:
        reasons.append(f"Freezing temperature ({round(temperature_c, 1)}°C)")
    elif temperature_c < 5:
        reasons.append(f"Cold temperature ({round(temperature_c, 1)}°C)")
    elif temperature_c > 40:
        reasons.append(f"Extreme heat ({round(temperature_c, 1)}°C)")
    elif temperature_c > 35:
        reasons.append(f"High temperature ({round(temperature_c, 1)}°C)")

    # Overall rating
    if (
        weather_code >= 95
        or gust_kmh > 55
        or rain_chance > 60
        or temperature_c < 0
        or temperature_c > 40
    ):
        rating = "red"
    elif (
        gust_kmh > 35
        or rain_chance > 30
        or cloud_pct > 85
        or temperature_c < 5
        or temperature_c > 35
    ):
        rating = "yellow"
    else:
        rating = "green"

    if not reasons:
        description = "Good launch conditions."
    else:
        description = "; ".join(reasons) + "."

    return {
        "rating": rating,
        "description": description,
        "temperature_c": round(temperature_c, 1),
        "wind_gust_kmh": round(gust_kmh),
        "rain_probability": round(rain_chance),
        "cloud_cover": round(cloud_pct),
    }


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
            "hourly": "wind_gusts_10m,precipitation_probability,cloud_cover,weather_code,temperature_2m",
            "forecast_days": 16,
            "timezone": "UTC",
        },
        timeout=8,
    )
    response.raise_for_status()
    hourly = response.json()["hourly"]

    ratings = {
        hour: _rate_hour(gust, rain, cloud, code, temp)
        for hour, gust, rain, cloud, code, temp in zip(
            hourly["time"],
            hourly["wind_gusts_10m"],
            hourly["precipitation_probability"],
            hourly["cloud_cover"],
            hourly["weather_code"],
            hourly["temperature_2m"],
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
        return [
            {
                "rating": "yellow",
                "description": "Weather forecast unavailable; conditions could not be confirmed.",
                "wind_gust_kmh": None,
                "rain_probability": None,
                "cloud_cover": None,
            }
            for _ in start_times
        ]

    return [
        ratings.get(
            t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00"),
            {
                "rating": "yellow",
                "description": "Weather forecast unavailable for this time.",
                "wind_gust_kmh": None,
                "rain_probability": None,
                "cloud_cover": None,
            }
        )
        for t in start_times
    ]