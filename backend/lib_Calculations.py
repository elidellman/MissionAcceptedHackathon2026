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


def get_AdjustedAzimuth()