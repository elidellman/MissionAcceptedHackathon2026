from datetime import datetime, timezone

from backend.Calculations import calculate_launch_windows

from backend.flaskr.weather.weatherApi import (
    check_orbital_windows
)


# Launch site mapping

ORBITAL_TO_WEATHER_SITE = {
    "CapeCanaveral": "cape-canaveral",
    "NovaScotia": "nova-scotia"
}


# Generate launch windows + weather

def generate_launch_windows_with_weather(
    launch_site,
    orbit_type,
    raan=30,
    window_minutes=10,
    vehicle_duration=480,
    number_of_windows=5
):

    # 1. Get orbital windows from Oliver's code

    current_time = datetime.now(timezone.utc)

    orbital_windows = calculate_launch_windows(
        launch_site,
        orbit_type,
        raan,
        current_time,
        window_minutes,
        vehicle_duration,
        number_of_windows
    )

    # 2. Convert launch site name to weather site ID

    weather_site = ORBITAL_TO_WEATHER_SITE.get(
        launch_site
    )

    if weather_site is None:
        raise ValueError(
            f"Unknown launch site: {launch_site}"
        )

    # 3. Check weather for all orbital windows

    windows_with_weather = check_orbital_windows(
        weather_site,
        orbital_windows
    )

    return windows_with_weather

# TESTING 
if __name__ == "__main__":

    results = generate_launch_windows_with_weather(
        launch_site="CapeCanaveral",
        orbit_type="LEO",
        raan=30,
        window_minutes=10,
        vehicle_duration=480,
        number_of_windows=5
    )

    print()
    print("==============================")
    print("LAUNCH WINDOWS + WEATHER")
    print("==============================")

    for window in results:

        print()
        print("Window:", window["id"])
        print("Start:", window["start"])
        print("Peak:", window["peak"])
        print("End:", window["end"])
        print("Weather:", window["weather"])