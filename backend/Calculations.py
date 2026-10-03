import time
from datetime import datetime, timedelta, timezone

from backend.launch_data import filter_conflicting_windows, get_cape_launches, get_ns_launches
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
_launch_cache = {}  # launch_site -> (fetched_at, launches)


def _existing_launches(launch_site, fetch):
    cached = _launch_cache.get(launch_site)
    if cached and time.time() - cached[0] < _LAUNCH_CACHE_SECONDS:
        return cached[1]
    try:
        launches = fetch()
    except Exception as error:
        print(f"[launch_data] couldn't fetch existing launches for {launch_site}: {error}")
        return cached[1] if cached else []
    _launch_cache[launch_site] = (time.time(), launches)
    return launches


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
            end_time,
            vehicle_duration or 0
        )

    # Check existing launches
    if launch_site == "CapeCanaveral":
        launches = _existing_launches(launch_site, get_cape_launches)
        windows = filter_conflicting_windows(
            windows,
            launches
        )

    if launch_site == "SpacePort":
        launches = _existing_launches(launch_site, get_ns_launches)
        windows = filter_conflicting_windows(
            windows,
            launches
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