from datetime import datetime, timedelta, timezone

from lib_Calculations import (
    OrbitTypes,
    get_Azimuth,
    get_AdjustedAzimuth,
    get_window_times
)


def calculate_launch_windows(
    orbit_type,
    altitude,
    launch_site,
    raan=None,
    vehicle_duration=None,
):
    inclination = OrbitTypes[orbit_type]["inclination"]

    azimuth = get_Azimuth(
        launch_site,
        orbit_type
    )

    adjusted_azimuth = get_AdjustedAzimuth(
        azimuth,
        vehicle_duration
    )

    current_time = datetime.now(timezone.utc).replace(
        minute=0,
        second=0,
        microsecond=0
    )

    # Basic mode: every hour for 16 days
    if raan is None:

        windows = [
            {
                "start": current_time + timedelta(hours=i),
                "end": current_time + timedelta(hours=i + 1),
                "available": True
            }
            for i in range(384)
        ]

    # Advanced mode: actual RAAN alignment windows
    else:

        end_time = current_time + timedelta(days=16)

        windows = get_window_times(
            launch_site,
            inclination,
            raan,
            current_time,
            10,
            end_time
        )

    return {
        "launch_site": launch_site,
        "orbit_type": orbit_type,
        "inclination": inclination,
        "altitude": altitude,
        "azimuth": azimuth,
        "adjusted_azimuth": adjusted_azimuth,
        "windows": windows
    }