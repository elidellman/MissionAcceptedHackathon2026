from backend.Calculations import calculate_launch_windows

from backend.flaskr.weather.weatherApi import (
    check_orbital_windows
)


# =========================================================
# Launch site mapping
# =========================================================

ORBITAL_TO_WEATHER_SITE = {
    "CapeCanaveral": "cape-canaveral",
    "NovaScotia": "nova-scotia"
}


# =========================================================
# Generate launch windows + weather
# =========================================================

def generate_launch_windows_with_weather(
    launch_site,
    orbit_type,
    altitude=500_000,
    raan=30,
    vehicle_duration=480
):

    # -----------------------------------------------------
    # 1. Get orbital windows from Oliver's code
    # -----------------------------------------------------

    orbital_result = calculate_launch_windows(
        orbit_type=orbit_type,
        altitude=altitude,
        launch_site=launch_site,
        raan=raan,
        vehicle_duration=vehicle_duration
    )

    orbital_windows = orbital_result["windows"]

    # -----------------------------------------------------
    # 2. Convert orbital launch site to weather site
    # -----------------------------------------------------

    weather_site = ORBITAL_TO_WEATHER_SITE.get(
        launch_site
    )

    if weather_site is None:
        raise ValueError(
            f"Unknown launch site: {launch_site}"
        )

    # -----------------------------------------------------
    # 3. Check weather for each orbital window
    # -----------------------------------------------------

    windows_with_weather = check_orbital_windows(
        weather_site,
        orbital_windows
    )

    # -----------------------------------------------------
    # 4. Return combined result
    # -----------------------------------------------------

    return {
        "launch_site": orbital_result["launch_site"],
        "orbit_type": orbital_result["orbit_type"],
        "inclination": orbital_result["inclination"],
        "altitude": orbital_result["altitude"],
        "azimuth": orbital_result["azimuth"],
        "adjusted_azimuth": orbital_result["adjusted_azimuth"],
        "windows": windows_with_weather
    }


# =========================================================
# TEST
# =========================================================

if __name__ == "__main__":

    result = generate_launch_windows_with_weather(
        launch_site="CapeCanaveral",
        orbit_type="LEO",
        altitude=500_000,
        raan=30,
        vehicle_duration=480
    )

    print()
    print("==============================")
    print("LAUNCH WINDOWS + WEATHER")
    print("==============================")

    print()
    print("Launch Site:", result["launch_site"])
    print("Orbit Type:", result["orbit_type"])
    print("Inclination:", result["inclination"])
    print("Altitude:", result["altitude"])
    print("Azimuth:", result["azimuth"])
    print("Adjusted Azimuth:", result["adjusted_azimuth"])

    print()
    print(
        "Number of windows:",
        len(result["windows"])
    )

    for window in result["windows"]:

        print()
        print("Window:", window["id"])
        print("Start:", window["start"])
        print("Peak:", window["peak"])
        print("End:", window["end"])
        print("Weather:", window["weather"])
        print("Forecast hour:", window["weather_time"])

        print("Weather checks:")

        for name, check in window["checks"].items():

            print(
                f"  {name}: {check['status']}"
            )