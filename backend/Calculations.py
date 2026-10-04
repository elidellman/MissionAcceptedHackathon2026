import time
from datetime import datetime, timedelta, timezone

from backend.launch_data import filter_conflicting_windows, get_all_upcoming_launches, launches_at_site
from backend.lib_Calculations import (
    OrbitTypes,
    get_Azimuth,
    get_AdjustedAzimuth,
    get_window_times
)


# The Space Devs API allows ~15 requests/hour without a key, so cache each site's
# upcoming launches for 30 minutes. If the fetch fails, skip the conflict check
# instead of failing the whole calculation.
_LAUNCH_CACHE_SECONDS = 30 * 60
_launch_cache = {"fetched_at": 0, "launches": None}  # one fetch covers every site


def _existing_launches(launch_site):
    if _launch_cache["launches"] is None or time.time() - _launch_cache["fetched_at"] > _LAUNCH_CACHE_SECONDS:
        try:
            _launch_cache["launches"] = get_all_upcoming_launches()
            _launch_cache["fetched_at"] = time.time()
        except Exception as error:
            print(f"[launch_data] couldn't fetch existing launches: {error}")
            if _launch_cache["launches"] is None:
                return []
    return launches_at_site(_launch_cache["launches"], launch_site)


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
                "start": current_time + timedelta(hours=hour),
                "end": current_time + timedelta(hours=hour + 1),
                "available": True
            }
            for hour in range(384)
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
            end_time,
            vehicle_duration or 0
        )

    # Remove windows that clash with launches already scheduled at this site
    windows = filter_conflicting_windows(
        windows,
        _existing_launches(launch_site)
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