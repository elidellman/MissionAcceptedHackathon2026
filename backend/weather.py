"""
Weather rating for each launch window, combining two engines on the same Open-Meteo forecast:

  1. Launch rules (backend/flaskr/weather/weatherApi.py): hard limits for surface wind,
     gusts, rain, visibility, winds aloft, thunderstorms and low cloud. Any failure = NO-GO.
  2. Early warning (this file): softer signs that conditions are marginal, such as rising
     gusts, a chance of rain, heavy cloud or temperature extremes.

Combined rating per window:
    red     = NO-GO        a launch rule fails (or severe weather spotted by the early warning)
    yellow  = CAUTION      every launch rule passes, but the early warning flags something
    green   = GO           every launch rule passes and nothing is flagged
    unknown = NO FORECAST  the window is beyond the 16-day forecast

If the launch-rule engine can't run (missing libraries, API down), the early-warning rating
is used on its own, so the app never breaks.
"""
import math
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


def _early_warning(lat, lon, start_times):
    """Early-warning rating per start time (timezone-aware datetimes)."""
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


# ─────────────────────────────────────────────────────────────────────────────
# Launch rules (teammate's engine) + combined rating
# ─────────────────────────────────────────────────────────────────────────────

_rules_cache = {}  # (lat, lon) -> (fetched_at, {"YYYY-MM-DDTHH:00": {"status", "checks"}})


def _rule_text(name, check):
    """Plain-English reason for a failed launch rule."""
    v = check.get("value")
    limit = check.get("limit")
    return {
        "surface_wind": f"Surface wind {v} mph (limit {limit})",
        "wind_gusts": f"Gusts {v} mph (limit {limit})",
        "rain": f"Rain {v} in/hr (limit {limit})",
        "visibility": f"Visibility {v} mi (minimum {limit})",
        "winds_aloft": f"Winds aloft {check.get('maximum_mph')} mph (limit {limit})",
        "thunderstorm": "Thunderstorm forecast",
        "cloud_ceiling_proxy": f"Low cloud {v}% (limit {limit}%)",
    }.get(name, name.replace("_", " "))


def _has_data(check):
    """A check whose forecast value is missing (NaN) is skipped instead of failing."""
    value = check.get("maximum_mph", check.get("value"))
    return not (isinstance(value, float) and math.isnan(value))


def _launch_rules(lat, lon):
    """Run the launch-rule engine for every forecast hour. Raises if it can't run."""
    key = (round(lat, 3), round(lon, 3))
    cached = _rules_cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]

    # Imported here so a missing library (pandas, openmeteo-requests…) only disables this layer
    from backend.flaskr.weather import weatherApi

    forecast = weatherApi.get_weather_forecast(lat, lon, days=16)
    results = {}
    for _, hour in forecast.iterrows():
        try:
            evaluated = weatherApi.evaluate_weather(hour)
            checks = {name: c for name, c in evaluated["checks"].items() if _has_data(c)}
        except (ValueError, TypeError):
            checks = {}  # a blank forecast value this hour: rely on the early warning
        results[hour["time"].strftime("%Y-%m-%dT%H:00")] = checks

    _rules_cache[key] = (time.time(), results)
    return results


def rate_windows(lat, lon, start_times):
    """
    Combined rating per start time: {"rating", "description", ...}.
    rating is "green" | "yellow" | "red" | "unknown".
    """
    early = _early_warning(lat, lon, start_times)

    try:
        rules = _launch_rules(lat, lon)
    except Exception as error:
        print(f"[weather] launch-rule engine unavailable, using early warning only: {error}")
        return early

    combined = []
    for t, warning in zip(start_times, early):
        hour = t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00")
        checks = rules.get(hour)

        # Beyond the forecast: neither engine has data for this hour
        if checks is None:
            combined.append({
                "rating": "unknown",
                "description": "No forecast yet: forecasts only cover the next 16 days.",
            })
            continue

        failed = [_rule_text(name, c) for name, c in checks.items() if c["status"] == "FAIL"]
        warned = warning.get("description", "")
        flagged = warning.get("rating") in ("yellow", "red") and warned not in ("", "Good launch conditions.")

        if failed:
            rating = "red"
            description = "Fails launch rules: " + "; ".join(failed) + "."
            if flagged:
                description += " Also: " + warned
        elif warning.get("rating") == "red":
            rating = "red"
            description = "Launch rules pass, but severe conditions: " + warned
        elif warning.get("rating") == "yellow":
            rating = "yellow"
            description = "Launch rules pass, but watch: " + warned
        else:
            rating = "green"
            description = "All launch rules pass (wind, gusts, rain, visibility, winds aloft, storms, low cloud)."

        combined.append({
            **warning,
            "rating": rating,
            "description": description,
            "checks": checks,
        })

    return combined
