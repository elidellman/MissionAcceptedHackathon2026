import math

from lib_Calculations import OrbitTypes, get_Azimuth, get_AdjustedAzimuth, get_window_times


def calculate_launch_windows(
    launchSite,
    orbitType,
    raan,
    current_time,
    window_minutes=10,
    vehicle_duration=0,
    numberOfWindows=2
):
    # Get orbital parameters
    inclination = OrbitTypes[orbitType]["inclination"]

    # Calculate nominal launch azimuth
    azimuth = get_Azimuth(
        launchSite,
        orbitType
    )

    # Calculate adjusted azimuth
    adjusted_azimuth = get_AdjustedAzimuth(
        azimuth,
        vehicle_duration
    )

    # Calculate launch windows
    windows = get_window_times(
        launchSite,
        inclination,
        raan,
        current_time,
        window_minutes,
        numberOfWindows
    )

    return {
        "launch_site": launchSite,
        "orbit_type": orbitType,
        "inclination": inclination,
        "azimuth": azimuth,
        "adjusted_azimuth": adjusted_azimuth,
        "windows": windows
    }