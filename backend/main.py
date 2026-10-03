import os
from datetime import datetime, timezone
from Calculations import calculate_launch_windows
from lib_Calculations import get_Azimuth, get_AdjustedAzimuth, get_plane_intersections, get_intersection_time, get_window_times

if __name__ == "__main__":

    # -----------------------------------
    # MOCK MISSION INPUT
    # -----------------------------------

    launchSite = "CapeCanaveral"
    orbitType = "LEO"
    inclination = 45
    raan = 30
    vehicleDuration = 480  # 8 minutes
    window_minutes = 10
    numberOfWindows = 10

    current_time = datetime.now(timezone.utc)

    print("=" * 50)
    print("        ORBITAL ARCHITECT MOCK")
    print("=" * 50)

    print("\nMISSION INPUT")
    print(f"Launch Site:       {launchSite}")
    print(f"Orbit Type:        {orbitType}")
    print(f"Inclination:       {inclination}°")
    print(f"RAAN:              {raan}°")
    print(f"Vehicle Duration:  {vehicleDuration} seconds")
    print(f"Current Time:      {current_time}")

    # -----------------------------------
    # STEP 1: AZIMUTH
    # -----------------------------------

    azimuth = get_Azimuth(
        launchSite,
        orbitType
    )

    print("\nSTEP 1 — AZIMUTH")
    print(f"Required Azimuth: {azimuth:.3f}°")

    # -----------------------------------
    # STEP 2: ADJUSTED AZIMUTH
    # -----------------------------------

    adjusted_azimuth = get_AdjustedAzimuth(
        azimuth,
        vehicleDuration
    )

    print("\nSTEP 2 — ADJUSTED AZIMUTH")
    print(f"Vehicle Duration: {vehicleDuration} seconds")
    print(
        f"Adjusted Azimuth: "
        f"{adjusted_azimuth:.3f}°"
    )

    # -----------------------------------
    # STEP 3: PLANE INTERSECTIONS
    # -----------------------------------

    intersections = get_plane_intersections(
        launchSite,
        inclination,
        raan
    )

    print("\nSTEP 3 — PLANE INTERSECTIONS")

    if intersections is None:
        print("No possible intersections.")
    else:
        for name, longitude in intersections.items():
            print(
                f"{name}: "
                f"{longitude:.3f}°"
            )

    # -----------------------------------
    # STEP 4: INTERSECTION TIMES
    # -----------------------------------

    print("\nSTEP 4 — INTERSECTION TIMES")

    for name, longitude in intersections.items():

        intersection_time = get_intersection_time(
            launchSite,
            longitude,
            current_time
        )

        print(
            f"{name}: "
            f"{intersection_time}"
        )

    # -----------------------------------
    # STEP 5: LAUNCH WINDOWS
    # -----------------------------------

    print("\nSTEP 5 — LAUNCH WINDOWS")

    windows = get_window_times(
        launchSite,
        inclination,
        raan,
        current_time,
        window_minutes,
        numberOfWindows
    )

    for i, window in enumerate(windows, 1):

        print(f"\nWindow {i}")
        print(f"  Start: {window['start']}")
        print(f"  Peak:  {window['peak']}")
        print(f"  End:   {window['end']}")

    print("\n" + "=" * 50)
    print("             END MOCK")
    print("=" * 50)