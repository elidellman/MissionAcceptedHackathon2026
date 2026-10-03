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
from datetime import datetime


if __name__ == "__main__":

    test_missions = [
        {
            "launch_site": "CapeCanaveral",
            "orbit_type": "LEO",
            "altitude": 500_000,
            "raan": 30,
            "vehicle_duration": 480
        },
        {
            "launch_site": "NovaScotia",
            "orbit_type": "POLAR",
            "altitude": 500_000,
            "raan": 30,
            "vehicle_duration": 480
        }
    ]

    for mission in test_missions:

        result = generate_launch_windows_with_weather(
            launch_site=mission["launch_site"],
            orbit_type=mission["orbit_type"],
            altitude=mission["altitude"],
            raan=mission["raan"],
            vehicle_duration=mission["vehicle_duration"]
        )

        windows = result["windows"]

        total = len(windows)

        approved = [
            w for w in windows
            if w["weather"] == "green"
        ]

        rejected = [
            w for w in windows
            if w["weather"] == "red"
        ]

        unavailable = [
            w for w in windows
            if w["weather"] == "unknown"
        ]

        print()
        print("========================================")
        print("        LAUNCH WINDOW SUMMARY")
        print("========================================")

        print()
        print(f"LAUNCH SITE: {result['launch_site']}")
        print(f"ORBIT: {result['orbit_type']}")
        print(f"ALTITUDE: {result['altitude'] / 1000:.0f} km")
        print(f"INCLINATION: {result['inclination']}°")

        print()
        print(f"Total orbital windows: {total}")
        print(f"Weather-approved: {len(approved)}")
        print(f"Weather-rejected: {len(rejected)}")
        print(f"Weather-unavailable: {len(unavailable)}")

        # Find next weather-approved window
        if approved:

            next_window = approved[0]

            peak_time = datetime.fromisoformat(
                next_window["peak"]
            )

            formatted_time = peak_time.strftime(
                "%B %-d, %Y at %H:%M UTC"
            )

            print()
            print("NEXT AVAILABLE WINDOW:")
            print(formatted_time)
            print("Weather: GREEN")

        else:

            print()
            print("NEXT AVAILABLE WINDOW:")
            print("No weather-approved launch window available")

        # Show rejected windows
        if rejected:

            print()
            print("REJECTED WINDOWS:")

            for window in rejected:

                print(
                    f"  {window['id']} - "
                    f"{window['peak']}"
                )

                for name, check in window["checks"].items():

                    if check["status"] == "FAIL":
                        print(
                            f"      {name}: FAIL"
                        )