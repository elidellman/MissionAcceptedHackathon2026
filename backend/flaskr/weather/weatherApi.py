import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry


# ---------------------------------------------------------
# Open-Meteo setup
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Launch sites
# ---------------------------------------------------------

LAUNCH_SITES = {
    "CapeCanaveral": {
        "latitude": 28.5620,
        "longitude": -80.5772
    },

    "spaceport-nova-scotia": {
        "latitude": 45.303559,
        "longitude": -60.982891
    }
}


# ---------------------------------------------------------
# Launch weather criteria
# ---------------------------------------------------------

MAX_WIND_MPH = 30
MAX_RAIN_IN_HOUR = 1
MIN_VISIBILITY_MILES = 2


# ---------------------------------------------------------
# Get weather forecast
# ---------------------------------------------------------

def get_weather(latitude, longitude, launch_time):

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

        "forecast_days": 3,
        "timezone": "UTC",

        # Makes the API return values in units
        # that are easier for our launch criteria.
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

    # -----------------------------------------------------
    # Convert Open-Meteo timestamps to pandas timestamps
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Put the forecast into a DataFrame
    # -----------------------------------------------------

    weather = pd.DataFrame({
        "time": times,

        "temperature": (
            hourly.Variables(0)
            .ValuesAsNumpy()
        ),

        "cloud_cover": (
            hourly.Variables(1)
            .ValuesAsNumpy()
        ),

        "visibility": (
            hourly.Variables(2)
            .ValuesAsNumpy()
        ),

        "rain": (
            hourly.Variables(3)
            .ValuesAsNumpy()
        ),

        "wind_speed": (
            hourly.Variables(4)
            .ValuesAsNumpy()
        ),

        "wind_gusts": (
            hourly.Variables(5)
            .ValuesAsNumpy()
        ),

        "wind_80m": (
            hourly.Variables(6)
            .ValuesAsNumpy()
        ),

        "wind_120m": (
            hourly.Variables(7)
            .ValuesAsNumpy()
        ),

        "wind_180m": (
            hourly.Variables(8)
            .ValuesAsNumpy()
        )
    })

    # -----------------------------------------------------
    # Convert requested launch time to UTC
    # -----------------------------------------------------

    launch_time = pd.to_datetime(
        launch_time,
        utc=True
    )

    # -----------------------------------------------------
    # Find forecast hour closest to launch time
    # -----------------------------------------------------

    weather["time_difference"] = abs(
        weather["time"] - launch_time
    )

    closest = weather.loc[
        weather["time_difference"].idxmin()
    ]

    return closest


# ---------------------------------------------------------
# Check weather against launch criteria
# ---------------------------------------------------------

def check_launch_weather(
    latitude,
    longitude,
    launch_time
):

    weather = get_weather(
        latitude,
        longitude,
        launch_time
    )

    checks = {}

    # -----------------------------------------------------
    # Surface wind
    # -----------------------------------------------------

    wind = float(
        weather["wind_speed"]
    )

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

    rain = float(
        weather["rain"]
    )

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
    #
    # Open-Meteo returns visibility in metres.
    # Convert metres -> miles.
    # -----------------------------------------------------

    visibility_meters = float(
        weather["visibility"]
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
    # These are informational for now.
    # They are NOT being treated as a real vehicle-specific
    # upper-air structural limit.
    # -----------------------------------------------------

    checks["winds_aloft"] = {
        "wind_80m_mph": round(
            float(weather["wind_80m"]),
            1
        ),

        "wind_120m_mph": round(
            float(weather["wind_120m"]),
            1
        ),

        "wind_180m_mph": round(
            float(weather["wind_180m"]),
            1
        ),

        "status": "INFO"
    }

    # -----------------------------------------------------
    # Overall launch decision
    # -----------------------------------------------------

    failed_checks = [
        name
        for name, check in checks.items()
        if check["status"] == "FAIL"
    ]

    if failed_checks:
        status = "NO-GO"
    else:
        status = "GO"

    # -----------------------------------------------------
    # Return structured result
    # -----------------------------------------------------

    return {
        "status": status,

        "launch_time": str(
            launch_time
        ),

        "weather_time": str(
            weather["time"]
        ),

        "checks": checks
    }


# ---------------------------------------------------------
# TEST
# ---------------------------------------------------------

if __name__ == "__main__":

    site = LAUNCH_SITES[
        "spaceport-nova-scotia"
    ]

    launch_time = (
        "2026-10-03T14:00:00Z"
    )

    print()
    print("==============================")
    print("   LAUNCH WEATHER CHECK")
    print("==============================")
    print()

    print(
        "Launch site:",
        "Spaceport Nova Scotia"
    )

    print(
        "Latitude:",
        site["latitude"]
    )

    print(
        "Longitude:",
        site["longitude"]
    )

    print(
        "Launch time:",
        launch_time
    )

    print()

    result = check_launch_weather(
        site["latitude"],
        site["longitude"],
        launch_time
    )

    print(
        "OVERALL STATUS:",
        result["status"]
    )

    print()
    print("Weather time:")
    print(
        result["weather_time"]
    )

    print()
    print("Criteria:")

    for name, check in result["checks"].items():

        print()
        print(name)

        for key, value in check.items():

            print(
                f"  {key}: {value}"
            )