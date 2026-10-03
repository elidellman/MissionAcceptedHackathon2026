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

    responses = openmeteo.weather_api(
        url,
        params=params
    )

    response = responses[0]
    hourly = response.Hourly()

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

        "temperature": hourly.Variables(0).ValuesAsNumpy(),
        "cloud_cover": hourly.Variables(1).ValuesAsNumpy(),
        "visibility": hourly.Variables(2).ValuesAsNumpy(),
        "rain": hourly.Variables(3).ValuesAsNumpy(),
        "wind_speed": hourly.Variables(4).ValuesAsNumpy(),
        "wind_gusts": hourly.Variables(5).ValuesAsNumpy(),
        "wind_80m": hourly.Variables(6).ValuesAsNumpy(),
        "wind_120m": hourly.Variables(7).ValuesAsNumpy(),
        "wind_180m": hourly.Variables(8).ValuesAsNumpy()
    })

    return weather


# =========================================================
# Evaluate weather for ONE hour
# =========================================================

def evaluate_weather(hour):

    checks = {}

    # Surface wind
    wind = float(hour["wind_speed"])

    checks["surface_wind"] = {
        "value": round(wind, 1),
        "limit": MAX_WIND_MPH,
        "unit": "mph",
        "status": "PASS" if wind <= MAX_WIND_MPH else "FAIL"
    }

    # Rain
    rain = float(hour["rain"])

    checks["rain"] = {
        "value": round(rain, 2),
        "limit": MAX_RAIN_IN_HOUR,
        "unit": "in/hr",
        "status": "PASS" if rain < MAX_RAIN_IN_HOUR else "FAIL"
    }

    # Visibility
    visibility_meters = float(hour["visibility"])
    visibility_miles = visibility_meters / 1609.344

    checks["visibility"] = {
        "value": round(visibility_miles, 2),
        "limit": MIN_VISIBILITY_MILES,
        "unit": "miles",
        "status": (
            "PASS"
            if visibility_miles >= MIN_VISIBILITY_MILES
            else "FAIL"
        )
    }

    # Winds aloft
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

    # Overall result
    failed_checks = [
        name
        for name, check in checks.items()
        if check["status"] == "FAIL"
    ]

    status = "red" if failed_checks else "green"

    return {
        "status": status,
        "checks": checks
    }


# =========================================================
# Evaluate weather at a specific time
# =========================================================

def evaluate_weather_at_time(weather, launch_time):

    launch_time = pd.to_datetime(
        launch_time,
        utc=True
    )

    weather = weather.copy()

    weather["time_difference"] = abs(
        weather["time"] - launch_time
    )

    closest = weather.loc[
        weather["time_difference"].idxmin()
    ]

    result = evaluate_weather(closest)

    return result, closest["time"]


# =========================================================
# Check weather for orbital windows
# =========================================================

def check_orbital_windows(site_id, windows):

    if site_id not in LAUNCH_SITES:
        raise ValueError(
            f"Unknown launch site: {site_id}"
        )

    site = LAUNCH_SITES[site_id]

    # Download forecast ONCE
    weather = get_weather_forecast(
        site["latitude"],
        site["longitude"],
        days=16
    )

    results = []

    for i, window in enumerate(windows, 1):

        # Use orbital window peak as launch time
        launch_time = window["peak"]

        weather_result, weather_time = (
            evaluate_weather_at_time(
                weather,
                launch_time
            )
        )

        results.append({
            "id": f"w{i}",

            "start": pd.to_datetime(
                window["start"],
                utc=True
            ).isoformat(),

            "peak": pd.to_datetime(
                window["peak"],
                utc=True
            ).isoformat(),

            "end": pd.to_datetime(
                window["end"],
                utc=True
            ).isoformat(),

            "weather": weather_result["status"],

            "weather_time": weather_time.isoformat(),

            "checks": weather_result["checks"]
        })

    return results

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
    # Test 1: One specific launch time
    # -----------------------------------------------------

    site_id = "nova-scotia"

    launch_time = "2026-10-03T14:00:00Z"

    print("Site:", site_id)
    print("Launch time:", launch_time)
    print()

    site = LAUNCH_SITES[site_id]

    weather = get_weather_forecast(
        site["latitude"],
        site["longitude"],
        days=16
    )

    result, weather_time = evaluate_weather_at_time(
        weather,
        launch_time
    )

    print("Forecast hour:", weather_time)
    print("WEATHER:", result["status"])
    print()

    for name, check in result["checks"].items():

        print(name)

        for key, value in check.items():
            print(f"  {key}: {value}")

        print()

    # -----------------------------------------------------
    # Test 2: Simulated orbital windows
    #
    # These imitate what Oliver's code will eventually
    # give us.
    # -----------------------------------------------------

    print()
    print("==============================")
    print("   ORBITAL WINDOW TEST")
    print("==============================")
    print()

    test_windows = [
        {
            "start": "2026-10-03T14:00:00Z",
            "peak": "2026-10-03T14:05:00Z",
            "end": "2026-10-03T14:10:00Z"
        },

        {
            "start": "2026-10-03T18:00:00Z",
            "peak": "2026-10-03T18:05:00Z",
            "end": "2026-10-03T18:10:00Z"
        },

        {
            "start": "2026-10-04T12:00:00Z",
            "peak": "2026-10-04T12:05:00Z",
            "end": "2026-10-04T12:10:00Z"
        }
    ]

    orbital_results = check_orbital_windows(
        "nova-scotia",
        test_windows
    )

    for window in orbital_results:

        print("Window:", window["id"])
        print("Start:", window["start"])
        print("Peak:", window["peak"])
        print("End:", window["end"])
        print("Weather:", window["weather"])
        print("Forecast hour:", window["weather_time"])

        print()

        for name, check in window["checks"].items():

            print(
                f"  {name}: {check['status']}"
            )

        print()