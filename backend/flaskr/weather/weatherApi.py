import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry


# =========================================================
# Open-Meteo setup
# =========================================================

cache_session = requests_cache.CachedSession(
    ".cache",
    expire_after=3600
)

retry_session = retry(
    cache_session,
    retries=5,
    backoff_factor=0.2
)

openmeteo = openmeteo_requests.Client(
    session=retry_session
)


# =========================================================
# Launch sites
# =========================================================

LAUNCH_SITES = {
    "nova-scotia": {
        "name": "Spaceport Nova Scotia",
        "latitude": 45.303559,
        "longitude": -60.982891
    },

    "cape-canaveral": {
        "name": "Cape Canaveral SLC-40",
        "latitude": 28.5618,
        "longitude": -80.5770
    }
}


# =========================================================
# Weather criteria
# =========================================================

MAX_WIND_MPH = 30
MAX_RAIN_IN_HOUR = 1
MIN_VISIBILITY_MILES = 2
MAX_WINDS_ALOFT_MPH = 50


# =========================================================
# Get hourly weather forecast
# =========================================================

def get_weather_forecast(latitude, longitude, days=16):

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": latitude,
        "longitude": longitude,

        "hourly": [
            "temperature_2m",
            "cloud_cover",
            "visibility",
            "rain",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_speed_80m",
            "wind_speed_120m",
            "wind_speed_180m"
        ],

        "forecast_days": days,
        "timezone": "UTC",

        "wind_speed_unit": "mph",
        "precipitation_unit": "inch"
    }

    print("Requesting weather from Open-Meteo...")

    responses = openmeteo.weather_api(
        url,
        params=params
    )

    response = responses[0]
    hourly = response.Hourly()

    # Create timestamps for each hourly forecast
    times = pd.date_range(
        start=pd.to_datetime(
            hourly.Time(),
            unit="s",
            utc=True
        ),
        end=pd.to_datetime(
            hourly.TimeEnd(),
            unit="s",
            utc=True
        ),
        freq=pd.Timedelta(
            seconds=hourly.Interval()
        ),
        inclusive="left"
    )

    weather = pd.DataFrame({
        "time": times,

        "temperature": (
            hourly.Variables(0).ValuesAsNumpy()
        ),

        "cloud_cover": (
            hourly.Variables(1).ValuesAsNumpy()
        ),

        "visibility": (
            hourly.Variables(2).ValuesAsNumpy()
        ),

        "rain": (
            hourly.Variables(3).ValuesAsNumpy()
        ),

        "wind_speed": (
            hourly.Variables(4).ValuesAsNumpy()
        ),

        "wind_gusts": (
            hourly.Variables(5).ValuesAsNumpy()
        ),

        "wind_80m": (
            hourly.Variables(6).ValuesAsNumpy()
        ),

        "wind_120m": (
            hourly.Variables(7).ValuesAsNumpy()
        ),

        "wind_180m": (
            hourly.Variables(8).ValuesAsNumpy()
        )
    })

    return weather


# =========================================================
# Evaluate weather for ONE hour
# =========================================================

def evaluate_weather(hour):

    checks = {}

    # -----------------------------------------------------
    # Surface wind
    # -----------------------------------------------------

    wind = float(hour["wind_speed"])

    checks["surface_wind"] = {
        "value": round(wind, 1),
        "limit": MAX_WIND_MPH,
        "unit": "mph",
        "status": (
            "PASS"
            if wind <= MAX_WIND_MPH
            else "FAIL"
        )
    }

    # -----------------------------------------------------
    # Rain
    # -----------------------------------------------------

    rain = float(hour["rain"])

    checks["rain"] = {
        "value": round(rain, 2),
        "limit": MAX_RAIN_IN_HOUR,
        "unit": "in/hr",
        "status": (
            "PASS"
            if rain < MAX_RAIN_IN_HOUR
            else "FAIL"
        )
    }

    # -----------------------------------------------------
    # Visibility
    # -----------------------------------------------------

    visibility_meters = float(
        hour["visibility"]
    )

    visibility_miles = (
        visibility_meters / 1609.344
    )

    checks["visibility"] = {
        "value": round(
            visibility_miles,
            2
        ),
        "limit": MIN_VISIBILITY_MILES,
        "unit": "miles",
        "status": (
            "PASS"
            if visibility_miles >= MIN_VISIBILITY_MILES
            else "FAIL"
        )
    }

    # -----------------------------------------------------
    # Winds aloft
    #
    # -----------------------------------------------------

    wind_80m = float(hour["wind_80m"])
    wind_120m = float(hour["wind_120m"])
    wind_180m = float(hour["wind_180m"])

    max_wind_aloft = max(
        wind_80m,
        wind_120m,
        wind_180m
    )

    checks["winds_aloft"] = {
        "wind_80m_mph": round(wind_80m, 1),
        "wind_120m_mph": round(wind_120m, 1),
        "wind_180m_mph": round(wind_180m, 1),
        "maximum_mph": round(max_wind_aloft, 1),
        "limit": MAX_WINDS_ALOFT_MPH,
        "unit": "mph",
        "status": (
           "PASS"
            if max_wind_aloft <= MAX_WINDS_ALOFT_MPH
            else "FAIL"
        )
    }

    # -----------------------------------------------------
    # Overall status
    # -----------------------------------------------------

    failed_checks = [
        name
        for name, check in checks.items()
        if check["status"] == "FAIL"
    ]

    if failed_checks:
        status = "red"
    else:
        status = "green"

    return {
        "status": status,
        "checks": checks
    }


# =========================================================
# Check weather for ONE specific launch time
# =========================================================

def get_weather_status(site_id, launch_time):

    if site_id not in LAUNCH_SITES:
        raise ValueError(
            f"Unknown launch site: {site_id}"
        )

    site = LAUNCH_SITES[site_id]

    weather = get_weather_forecast(
        site["latitude"],
        site["longitude"]
    )

    launch_time = pd.to_datetime(
        launch_time,
        utc=True
    )

    # Find the forecast hour closest to launch time
    weather["time_difference"] = abs(
        weather["time"] - launch_time
    )

    closest = weather.loc[
        weather["time_difference"].idxmin()
    ]

    result = evaluate_weather(closest)

    return {
        "site_id": site_id,
        "launch_time": launch_time.isoformat(),
        "weather_time": closest["time"].isoformat(),
        "weather": result["status"],
        "checks": result["checks"]
    }


# =========================================================
# Find weather conditions for EVERY hour in a window
# =========================================================

def get_weather_windows(
    site_id,
    start_time,
    end_time
):

    if site_id not in LAUNCH_SITES:
        raise ValueError(
            f"Unknown launch site: {site_id}"
        )

    site = LAUNCH_SITES[site_id]

    start_time = pd.to_datetime(
        start_time,
        utc=True
    )

    end_time = pd.to_datetime(
        end_time,
        utc=True
    )

    if end_time < start_time:
        raise ValueError(
            "end_time must be after start_time"
        )

    # Calculate how many days of forecast we need
    days = max(
        1,
        (end_time - start_time).days + 1
    )

    # Open-Meteo forecast limit is handled by requesting
    # up to 16 days here.
    days = min(days, 16)

    weather = get_weather_forecast(
        site["latitude"],
        site["longitude"],
        days=days
    )

    # Only keep the requested time window
    weather = weather[
        (weather["time"] >= start_time)
        &
        (weather["time"] <= end_time)
    ]

    results = []

    for _, hour in weather.iterrows():

        result = evaluate_weather(hour)

        results.append({
            "time": hour["time"].isoformat(),
            "weather": result["status"],
            "checks": result["checks"]
        })

    return {
        "site_id": site_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "hours": results
    }


# =========================================================
# TEST
# =========================================================

if __name__ == "__main__":

    print()
    print("==============================")
    print("   LAUNCH WEATHER TEST")
    print("==============================")
    print()

    # -----------------------------------------------------
    # Test one specific launch time
    # -----------------------------------------------------

    site_id = "nova-scotia"

    launch_time = "2026-10-03T14:00:00Z"

    print("Site:", site_id)
    print("Launch time:", launch_time)
    print()

    result = get_weather_status(
        site_id,
        launch_time
    )

    print(
        "WEATHER:",
        result["weather"]
    )

    print(
        "Forecast hour:",
        result["weather_time"]
    )

    print()

    for name, check in result["checks"].items():

        print(name)

        for key, value in check.items():

            print(
                f"  {key}: {value}"
            )

        print()

    # -----------------------------------------------------
    # Test hourly weather window
    # -----------------------------------------------------

    print()
    print("==============================")
    print("   HOURLY WEATHER WINDOW")
    print("==============================")
    print()

    hourly_result = get_weather_windows(
        "nova-scotia",
        "2026-10-03T00:00:00Z",
        "2026-10-19T23:00:00Z"
    )

    for hour in hourly_result["hours"]:

        print(
            hour["time"],
            "->",
            hour["weather"]
        )