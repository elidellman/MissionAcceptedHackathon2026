from datetime import datetime, timezone

from Calculations import calculate_launch_windows
from launch_data import filter_conflicting_windows, get_cape_launches


if __name__ == "__main__":

    print("=" * 60)
    print("              ORBITAL ARCHITECT MOCK")
    print("=" * 60)

    # -----------------------------------
    # MOCK MISSION INPUT
    # -----------------------------------

    launch_site = "CapeCanaveral"
    orbit_type = "LEO"
    altitude = 500_000

    # Advanced settings
    raan = 67
    vehicle_duration = 480  # 8 minutes

    current_time = datetime.now(timezone.utc)

    print("\nMISSION INPUT")
    print(f"Launch Site:       {launch_site}")
    print(f"Orbit Type:        {orbit_type}")
    print(f"Altitude:          {altitude / 1000:.0f} km")
    print(f"RAAN:              {raan}°")
    print(f"Vehicle Duration:  {vehicle_duration} seconds")
    print(f"Current Time:      {current_time}")

    # -----------------------------------
    # RUN ADVANCED CALCULATION
    # -----------------------------------

    result = calculate_launch_windows(
        orbit_type=orbit_type,
        altitude=altitude,
        launch_site=launch_site,
        raan=raan,
        vehicle_duration=vehicle_duration
    )

    # -----------------------------------
    # RESULTS
    # -----------------------------------

    print("\nRESULTS")

    print(f"Calculated Inclination: {result['inclination']}°")
    if('azimuth' in result and result['azimuth'] is not None):
        print(f"Azimuth:                {result['azimuth']:.3f}°")
        print(f"Adjusted Azimuth:       {result['adjusted_azimuth']:.3f}°")

    windows = result["windows"]
    launches = get_cape_launches()
    available_windows = filter_conflicting_windows(windows, launches)

    print(f"\nNumber of available launch windows: {len(available_windows)}")

    for number, window in enumerate(available_windows, 1):
        print(f"\nAvailable Window {number}")
        print(f"Start: {window['start'].strftime('%Y-%m-%d %H:%M')}")
        print(f"Peak:  {window['peak'].strftime('%Y-%m-%d %H:%M')}")
        print(f"End:   {window['end'].strftime('%Y-%m-%d %H:%M')}")

    print("\n" + "=" * 60)
    print("                   END MOCK")
    print("=" * 60)