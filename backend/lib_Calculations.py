import math

# LEO - Lower Earth Orbit 
# Polar - The Orbit from the South to the North Pole 
# SSO - The Orbit that moves with the sun
OrbitTypes = {
    "LEO" : 45.1, 
    "SSO": 98.1,
    "POLAR": 87.9
}

LaunchSites = {
    "CapeCanaveral": {
        "latitude": 28.5620,
        "longitude": -80.5772
    }
}


"""
Azurmith is the horizontal Mesaurement needed to reach specific inclination
It is defined as arcsin(cos(Inclination)/cos(Latitude))

Params: 
    launchSite [String]: Specify the name of the launch site to perform calculations on
    orbitType [String]: Specify "LEO", "SSO", "Polar"
"""

def get_Azurmith(launchSite, orbitType):

    inclination = OrbitTypes[orbitType]
    latitude = LaunchSites[launchSite]["latitude"]

    cos_inclination = math.radians(inclination)
    cos_latitude = math.radians(latitude)

    azimuth = math.asin(cos_inclination/cos_latitude)
    return math.degrees(azimuth)

