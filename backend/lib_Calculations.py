from datetime import timedelta
import math

# Constants
EARTH_RADIUS = 6_371_000          # meters
EARTH_MU = 3.986004418e14         # m^3/s^2
EARTH_ROTATION_RATE = 7.2921159e-5  # radians/second


# LEO - Low Earth Orbit
# Polar - Orbit passing close to the North and South Poles
# SSO - Sun-Synchronous Orbit
OrbitTypes = {
    "LEO": {
        "inclination": 45.1,
        "altitude": 500_000       # 500 km
    },

    "SSO": {
        "inclination": 98.1,
        "altitude": 600_000       # 600 km
    },

    "POLAR": {
        "inclination": 87.9,
        "altitude": 500_000       # 500 km
    }
}


LaunchSites = {
    "CapeCanaveral": {
        "latitude": 28.5620,
        "longitude": -80.5772
    }
}



"""
Azimuth is the horizontal Mesaurement needed to reach specific inclination
It is defined as arcsin(cos(Inclination)/cos(Latitude))

Params: 
    launchSite [String]: Specify the name of the launch site to perform calculations on
    orbitType [String]: Specify "LEO", "SSO", "Polar"
"""

def get_Azimuth(launchSite, orbitType):

    inclination = OrbitTypes[orbitType]["inclination"]
    latitude = LaunchSites[launchSite]["latitude"]

    cos_inclination = math.cos(math.radians(inclination))
    cos_latitude = math.cos(math.radians(latitude))

    azimuth = math.asin(cos_inclination/cos_latitude)
    return math.degrees(azimuth)

"""
Adjusted Azimuth is the Azimuth adjusted for the duration of the vehicle's flight.
It is defined as the Azimuth minus the product of the Earth's rotation rate and the vehicle's duration.

Params:
    azimuth [float]: The initial azimuth value.
    vehicleDuration [float]: The duration of the vehicle's flight in seconds.
"""

def get_AdjustedAzimuth(azimuth, vehicleDuration):
    adjusted_azimuth = azimuth - (EARTH_ROTATION_RATE * vehicleDuration)
    return adjusted_azimuth

"""
Plane intersections are the points where the orbital plane intersects with the Earth's surface.
This function calculates the intersections based on the launch site, orbit type, and right ascension of the ascending node.

Params:
    launchSite [String]: The name of the launch site.
    orbitType [String]: The type of orbit ("LEO", "SSO", "Polar").
    raan [float]: The right ascension of the ascending node in degrees.
"""

def get_plane_intersections(launchSite, inclination, raan):
    latitude = LaunchSites[launchSite]["latitude"]

    phi = math.radians(latitude)
    i = math.radians(inclination)
    omega = math.radians(raan)

    ratio = -math.tan(phi) / math.tan(i)

    # No intersection if mathematically impossible
    if abs(ratio) > 1:
        return None

    theta = math.asin(ratio)

    lambda_1 = omega - theta
    lambda_2 = omega - (math.pi - theta)

    # Convert to degrees
    lambda_1 = math.degrees(lambda_1)
    lambda_2 = math.degrees(lambda_2)

    # Normalize to [-180, 180]
    lambda_1 = (lambda_1 + 180) % 360 - 180
    lambda_2 = (lambda_2 + 180) % 360 - 180

    return {
        "intersection_1": lambda_1,
        "intersection_2": lambda_2
    }

"""
Calculates the time at which the orbital plane intersects with the Earth's surface based on the launch site
and the current time.

Params:
    launchSite [String]: The name of the launch site.
    intersection [float]: The longitude of the intersection point in degrees.
    current_time [float]: The current time in seconds since epoch.
"""

def get_intersection_time(launchSite, intersection, current_time):
    longitude = LaunchSites[launchSite]["longitude"]

    # Calculate Julian Date
    julian_date = current_time.timestamp() / 86400 + 2440587.5

    # Calculate Greenwich Mean Sidereal Time
    T = (julian_date - 2451545.0) / 36525.0

    gmst = (
        280.46061837
        + 360.98564736629 * (julian_date - 2451545.0)
        + 0.000387933 * T**2
        - T**3 / 38710000.0
    )

    # Normalize GMST to 0–360 degrees
    gmst %= 360

    # Calculate current inertial longitude of the launch site
    current_inertial_longitude = (gmst + longitude) % 360

    # Calculate the longitude difference
    delta_longitude = (intersection - current_inertial_longitude) % 360

    # Convert degrees to radians
    delta_longitude_rad = math.radians(delta_longitude)

    # Calculate the time difference in seconds
    time_difference = delta_longitude_rad / EARTH_ROTATION_RATE

    # Calculate the intersection time
    intersection_time = current_time + timedelta(
        seconds=time_difference
    )

    return intersection_time

"""
Creates a time window around the intersection time.

Params:
    intersection_time [datetime]: The time of the intersection.
    window_minutes [int]: The width of the window in minutes.
"""

def create_window(intersection_time, window_minutes=10):
    start_time = intersection_time - timedelta(
        minutes=window_minutes
    )

    end_time = intersection_time + timedelta(
        minutes=window_minutes
    )

    return {
        "start": start_time,
        "peak": intersection_time,
        "end": end_time
    }

"""
Calculates the launch windows based on the launch site, orbit type, right ascension of the
ascending node, and the current time.

Params:
    launchSite [String]: The name of the launch site.
    inclination [float]: The inclination of the orbit in degrees.
    raan [float]: The right ascension of the ascending node in degrees.
    current_time [float]: The current time in seconds since epoch.
    window_minutes [int]: The width of the window in minutes.
"""

def get_window_times(launchSite, inclination, raan, current_time, window_minutes=10):
    intersections = get_plane_intersections(launchSite, inclination, raan)

    if intersections is None:
        return []

    windows = []

    for intersection in intersections.values():
        intersection_time = get_intersection_time(
            launchSite,
            intersection,
            current_time
        )

        window = create_window(
            intersection_time,
            window_minutes
        )

        windows.append(window)

    windows.sort(key=lambda window: window["start"])
    return windows