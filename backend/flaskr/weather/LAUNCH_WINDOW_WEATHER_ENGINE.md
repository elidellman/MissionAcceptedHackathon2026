# Launch Window + Weather Engine Documentation

## 1. Overview

This project combines two systems:

1. **Orbital launch-window calculations** — determines when a launch site can reach a desired orbit based on orbital inclination and RAAN alignment.
2. **Weather filtering** — checks the calculated launch windows against weather conditions such as wind, rain, visibility, thunderstorms, winds aloft, cloud cover, and wind gusts.

The result is a list of launch windows that tells the user whether each window is:

- **GREEN** — all weather checks pass
- **RED** — at least one weather requirement fails
- **UNKNOWN** — weather data is unavailable for that launch time

The overall pipeline is:

```text
User selects mission
        |
        v
calculate_launch_windows()
        |
        |  Orbital mechanics
        v
Generate orbital windows
        |
        v
check_orbital_windows()
        |
        |  Weather API
        v
Get forecast for launch site
        |
        v
Evaluate weather at each window
        |
        v
Combine orbital + weather results
        |
        v
Final launch-window list
```

---

# 2. Project Structure

The main pieces of the system are:

```text
MissionAcceptedHackathon2026/
│
├── backend/
│   ├── Calculations.py
│   │   └── High-level launch-window calculation
│   │
│   ├── lib_Calculations.py
│   │   └── Orbital mechanics calculations
│   │
│   └── flaskr/
│       └── weather/
│           └── weatherApi.py
│               └── Weather API + weather filtering
│
└── Combined Launch Engine
    └── Connects orbital calculations to weather filtering
```

Each file has a different responsibility.

| File | Responsibility |
|---|---|
| `lib_Calculations.py` | Performs the lower-level orbital calculations |
| `Calculations.py` | Organizes orbital calculations and creates launch windows |
| `weatherApi.py` | Gets weather forecasts and evaluates weather conditions |
| Combined launch engine | Connects orbital windows to weather results |

---

# 3. Orbital Configuration — `lib_Calculations.py`

This file contains the constants and functions used to calculate orbital launch opportunities.

## Earth Constants

```python
EARTH_RADIUS = 6_371_000
EARTH_MU = 3.986004418e14
EARTH_ROTATION_RATE = 7.2921159e-5
```

These represent physical properties of Earth.

### `EARTH_RADIUS`

The approximate radius of Earth in metres.

### `EARTH_MU`

Earth's standard gravitational parameter.

It is useful for orbital-mechanics calculations, although the current launch-window code does not directly use it in the window calculation.

### `EARTH_ROTATION_RATE`

Earth's rotation rate in radians per second.

This is important because Earth rotates underneath an orbital plane. Therefore, the location of a launch site relative to the desired orbital plane changes with time.

---

# 4. Supported Orbit Types

The project defines three orbit types:

```python
OrbitTypes = {
    "LEO": {
        "inclination": 45.1,
        "altitude": 500_000,
        "orbital_direction": "prograde"
    },
    "SSO": {
        "inclination": 98.1,
        "altitude": 600_000,
        "orbital_direction": "retrograde"
    },
    "POLAR": {
        "inclination": 87.9,
        "altitude": 500_000,
        "orbital_direction": "prograde"
    }
}
```

The important value for the launch-window calculation is the **inclination**.

### Inclination

Inclination describes the angle between the orbit's plane and Earth's equatorial plane.

For example:

```text
LEO   -> 45.1°
POLAR -> 87.9°
SSO   -> 98.1°
```

The desired inclination determines the orientation of the orbital plane and therefore affects when a launch site can reach it.

---

# 5. Launch Sites

The project currently supports two launch sites:

```python
LaunchSites = {
    "CapeCanaveral": {
        "latitude": 28.5620,
        "longitude": -80.5772
    },
    "NovaScotia": {
        "latitude": 45.303559,
        "longitude": -60.982891
    }
}
```

Latitude and longitude are needed for the orbital calculations.

The same physical locations are also defined in `weatherApi.py` so the weather API knows which coordinates to request.

---

# 6. Calculating Launch Azimuth

The first major orbital calculation is:

```python
def get_Azimuth(launchSite, orbitType):
```

The function calculates the horizontal direction the vehicle needs to launch in order to reach the desired orbital inclination.

The simplified calculation is:

```python
cos_inclination = math.cos(math.radians(inclination))
cos_latitude = math.cos(math.radians(latitude))

azimuth = math.asin(cos_inclination / cos_latitude)
```

The result is converted back into degrees.

Conceptually:

```text
Desired orbit
      |
      | inclination
      v
Orbital plane
      ^
      |
Launch site
```

The launch site's latitude matters because a launch from a different latitude starts from a different position relative to the equator.

---

# 7. Adjusted Azimuth

The next function is:

```python
def get_AdjustedAzimuth(azimuth, vehicleDuration=None):
```

If no vehicle duration is provided, the original azimuth is returned.

If a duration is provided, the code attempts to account for Earth's rotation during the vehicle's flight:

```python
adjusted_azimuth = azimuth - (EARTH_ROTATION_RATE * vehicleDuration)
```

The idea is:

```text
Launch
  |
  | vehicle is flying
  v
Earth continues rotating
  |
  v
Final position is different
```

### Current implementation note

`EARTH_ROTATION_RATE` is expressed in radians/second, while `azimuth` is expressed in degrees. The current code subtracts these values directly. For a physically consistent calculation, the units should be converted before performing the subtraction.

This does not affect the general architecture of the system, but it is an important future improvement.

---

# 8. RAAN and Orbital Plane Intersections

The more advanced launch-window calculation uses **RAAN**.

RAAN stands for **Right Ascension of the Ascending Node**.

It describes the orientation of an orbital plane around Earth.

The function responsible for finding where the orbital plane intersects the launch-site latitude is:

```python
def get_plane_intersections(launchSite, inclination, raan):
```

The calculation begins with:

```python
ratio = -math.tan(phi) / math.tan(i)
```

where:

- `phi` = launch-site latitude
- `i` = orbital inclination

If:

```python
abs(ratio) > 1
```

then there is no valid intersection for that configuration, so the function returns `None`.

Otherwise, it calculates an angle:

```python
theta = math.asin(ratio)
```

and produces two possible intersection longitudes.

```python
lambda_1 = omega - theta
lambda_2 = omega - (math.pi - theta)
```

These represent locations where the orbital plane crosses the latitude of the launch site.

---

# 9. Why Plane Intersections Matter

A launch cannot simply happen at any time if the mission requires a specific orbital plane.

The launch site must line up with the desired orbital plane.

Think of it like this:

```text
                 Orbital plane
                      /
                     /
                    /
                   /
                  /
                 /
                /
       Earth   (O)
                |
                |
           Launch site
```

As Earth rotates, the launch site moves underneath the desired orbital plane.

Therefore, there are specific times when the launch site is correctly aligned.

Those times become the candidate launch windows.

---

# 10. Calculating When Alignment Occurs

The function:

```python
def get_intersection_time(launchSite, intersection, current_time):
```

calculates when Earth will rotate the launch site into the required position.

It first calculates the Julian Date:

```python
julian_date = current_time.timestamp() / 86400 + 2440587.5
```

The Julian Date is then used to calculate **GMST** — Greenwich Mean Sidereal Time.

The code calculates:

```python
gmst = (
    280.46061837
    + 360.98564736629 * (julian_date - 2451545.0)
    + 0.000387933 * T**2
    - T**3 / 38710000.0
)
```

GMST is used to determine Earth's rotational orientation relative to the stars.

The code then calculates the current inertial longitude of the launch site:

```python
current_inertial_longitude = (gmst + longitude) % 360
```

Then it finds how much longitude remains before the desired intersection:

```python
delta_longitude = (intersection - current_inertial_longitude) % 360
```

Finally, the longitude difference is converted into time using Earth's rotation rate:

```python
time_difference = delta_longitude_rad / EARTH_ROTATION_RATE
```

This gives the approximate future time when the launch site aligns with the orbital plane.

---

# 11. Creating a Launch Window

Once the exact alignment time is known, the code creates a launch window around it.

```python
def create_window(intersection_time, window_minutes=10):
```

The window is:

```text
          10 min          10 min
<------------------|------------------>
                   |
                 PEAK
                   |
                 alignment
```

The output looks like:

```python
{
    "start": intersection_time - 10 minutes,
    "peak": intersection_time,
    "end": intersection_time + 10 minutes
}
```

So each orbital opportunity has a 20-minute total window.

---

# 12. Generating All Orbital Windows

The function:

```python
def get_window_times(
    launchSite,
    inclination,
    raan,
    current_time,
    window_minutes=10,
    end_time=None
):
```

loops forward through time and finds every valid intersection.

The general algorithm is:

```text
Start at current time
       |
       v
Find orbital-plane intersections
       |
       v
Calculate next intersection time
       |
       v
Create ±10 minute window
       |
       v
Move forward slightly
       |
       v
Find next window
       |
       v
Continue until end_time
```

The code moves the search time to:

```python
next_time + timedelta(seconds=1)
```

This prevents the same intersection from being found repeatedly.

---

# 13. High-Level Orbital Engine — `Calculations.py`

`Calculations.py` provides the higher-level function:

```python
def calculate_launch_windows(
    orbit_type,
    altitude,
    launch_site,
    raan=None,
    vehicle_duration=None
):
```

It combines the lower-level orbital functions into one usable interface.

First, it gets the desired inclination:

```python
inclination = OrbitTypes[orbit_type]["inclination"]
```

Then it calculates:

```python
azimuth = get_Azimuth(launch_site, orbit_type)
adjusted_azimuth = get_AdjustedAzimuth(azimuth, vehicle_duration)
```

It also determines the current UTC time.

---

# 14. Two Modes of Window Generation

There are two possible modes.

## Basic mode: `raan=None`

If no RAAN is supplied, the code creates one window for every hour for 16 days.

```python
for i in range(384):
```

Since:

```text
16 days × 24 hours = 384 hours
```

this produces 384 hourly windows.

This is essentially a simplified testing/basic mode.

## RAAN mode: `raan` provided

If RAAN is supplied, the code calls:

```python
get_window_times(...)
```

This produces windows based on actual orbital-plane alignment.

The hackathon weather tests use:

```python
raan=30
```

so they use the RAAN-based calculation.

---

# 15. Weather System — `weatherApi.py`

The weather system uses the **Open-Meteo API**.

The code imports:

```python
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
```

Each library has a role:

| Library | Purpose |
|---|---|
| `openmeteo_requests` | Requests weather data from Open-Meteo |
| `pandas` | Stores and processes forecast data |
| `requests_cache` | Caches API responses |
| `retry_requests` | Automatically retries failed requests |

---

# 16. API Caching and Retries

The weather client is configured with:

```python
cache_session = requests_cache.CachedSession(
    ".cache",
    expire_after=3600
)
```

This means API responses can be cached for one hour.

Then:

```python
retry_session = retry(
    cache_session,
    retries=5,
    backoff_factor=0.2
)
```

allows failed requests to be retried.

Finally:

```python
openmeteo = openmeteo_requests.Client(
    session=retry_session
)
```

creates the Open-Meteo client.

This is useful because the launch engine may request a lot of forecast information, and repeated API requests are unnecessary if the forecast has already been cached.

---

# 17. Weather Launch Sites

The weather system uses the same physical locations as the orbital system, but with separate IDs:

```python
LAUNCH_SITES = {
    "nova-scotia": {
        "name": "Spaceport Nova Scotia",
        "latitude": 45.303559,
        "longitude": -60.982891
    },
    "cape-canaveral": {
        "name": "Cape Canaveral SLC-40",
        "latitude": 28.5618,
        "longitude": -80.5770
    }
}
```

These coordinates are passed to Open-Meteo.

---

# 18. Weather Requirements

The weather engine defines thresholds:

```python
MAX_WIND_MPH = 30
MAX_RAIN_IN_HOUR = 1
MIN_VISIBILITY_MILES = 2
MAX_WINDS_ALOFT_MPH = 50
MAX_WIND_GUST_MPH = 40
MIN_CLOUD_CEILING_FT = 5000
```

The current checks are:

| Condition | Requirement |
|---|---|
| Surface wind | ≤ 30 mph |
| Rain | < 1 in/hr |
| Visibility | ≥ 2 miles |
| Winds aloft | ≤ 50 mph |
| Thunderstorms | None detected |
| Low cloud cover proxy | < 50% |
| Wind gusts | ≤ 40 mph |

These are project-defined thresholds and should be treated as the current rules used by the engine, rather than as universal launch-safety standards.

---

# 19. Getting the Weather Forecast

The function:

```python
def get_weather_forecast(latitude, longitude, days=16):
```

requests a 16-day hourly forecast.

The API request includes variables such as:

```text
Temperature
Cloud cover
Low/mid/high cloud cover
Visibility
Rain
Weather code
10 m wind speed
10 m wind gusts
80 m wind speed
120 m wind speed
180 m wind speed
```

The result is converted into a Pandas DataFrame.

Conceptually:

```text
Open-Meteo
    |
    v
Hourly forecast
    |
    v
Pandas DataFrame
    |
    +-- time
    +-- wind_speed
    +-- wind_gusts
    +-- rain
    +-- visibility
    +-- cloud_cover
    +-- wind_80m
    +-- wind_120m
    +-- wind_180m
    +-- weather_code
```

---

# 20. Evaluating One Weather Hour

The main weather filtering function is:

```python
def evaluate_weather(hour):
```

It receives one row of the forecast and checks every requirement.

The function builds a dictionary:

```python
checks = {}
```

Each weather condition is then recorded as `PASS` or `FAIL`.

---

# 21. Surface Wind Check

The code checks:

```python
hour["wind_speed"] <= MAX_WIND_MPH
```

With:

```python
MAX_WIND_MPH = 30
```

Therefore:

```text
Wind ≤ 30 mph  -> PASS
Wind > 30 mph  -> FAIL
```

---

# 22. Rain Check

Rain is checked using:

```python
hour["rain"] < MAX_RAIN_IN_HOUR
```

The current threshold is:

```text
Rain < 1 in/hr -> PASS
Rain ≥ 1 in/hr -> FAIL
```

---

# 23. Visibility Check

Open-Meteo provides visibility in metres.

The code converts it into miles:

```python
visibility_miles = hour["visibility"] / 1609.344
```

Then checks:

```python
visibility_miles >= MIN_VISIBILITY_MILES
```

So:

```text
Visibility ≥ 2 miles -> PASS
Visibility < 2 miles -> FAIL
```

---

# 24. Winds Aloft Check

The system checks wind at three heights:

```text
80 m
120 m
180 m
```

It then takes the maximum:

```python
max_wind_aloft = max(
    hour["wind_80m"],
    hour["wind_120m"],
    hour["wind_180m"]
)
```

The requirement is:

```text
Maximum winds aloft ≤ 50 mph -> PASS
Maximum winds aloft > 50 mph -> FAIL
```

This gives the engine a simple way to detect strong winds above the surface.

---

# 25. Thunderstorm Check

Open-Meteo provides a weather code.

The code treats these as thunderstorm conditions:

```python
{95, 96, 99}
```

Therefore:

```text
Weather code 95/96/99 -> FAIL
Other weather codes    -> PASS
```

This is a categorical weather check rather than a numerical threshold.

---

# 26. Cloud Ceiling Proxy

The project requires a minimum cloud ceiling of:

```python
MIN_CLOUD_CEILING_FT = 5000
```

However, the current implementation does not directly calculate a true 5,000-foot cloud ceiling.

Instead, it uses `cloud_cover_low` as a proxy:

```python
hour["cloud_cover_low"] < 50
```

So the current interpretation is:

```text
Low cloud cover < 50% -> PASS
Low cloud cover ≥ 50% -> FAIL
```

This is an approximation and should be clearly described as such in a presentation.

---

# 27. Wind Gust Check

Wind gusts are checked separately from sustained wind:

```python
hour["wind_gusts"] <= MAX_WIND_GUST_MPH
```

The threshold is:

```text
Gusts ≤ 40 mph -> PASS
Gusts > 40 mph -> FAIL
```

A launch could therefore fail because of gusts even if the average/sustained wind is acceptable.

---

# 28. Overall Weather Status

After every check has been completed, the code determines the overall status.

If at least one check fails:

```text
RED
```

If every check passes:

```text
GREEN
```

Conceptually:

```text
             Weather checks
                   |
        +----------+----------+
        |          |          |
      Wind       Rain     Visibility
        |          |          |
        +----------+----------+
                   |
             Winds aloft
                   |
             Thunderstorms
                   |
             Cloud proxy
                   |
              Wind gusts
                   |
                   v
             Any failure?
              /         \
            YES          NO
             |            |
             v            v
            RED          GREEN
```

---

# 29. Checking Weather at a Specific Launch Time

The function:

```python
def evaluate_weather_at_time(weather, launch_time):
```

connects an orbital launch window to the weather forecast.

The important detail is that the weather forecast is hourly, while the orbital launch time can occur at any minute.

For example:

```text
Orbital launch peak:
2026-10-14 04:41:25 UTC

Forecast:
2026-10-14 04:00 UTC
2026-10-14 05:00 UTC
```

The code finds the forecast row closest to the launch time.

It then evaluates that forecast hour.

Therefore, the weather result is an approximation based on the nearest hourly forecast.

---

# 30. What Happens If Weather Data Is Missing?

If the requested launch time is outside the available forecast range, the function returns:

```python
{
    "status": "unknown",
    "checks": {},
    "reason": "Weather forecast unavailable for this launch time"
}
```

This is important because the system does **not** assume that missing weather data means good weather.

Instead:

```text
No weather data -> UNKNOWN
```

rather than:

```text
No weather data -> GREEN
```

---

# 31. Connecting Orbital Windows to Weather

The main integration function is:

```python
def check_orbital_windows(site_id, windows):
```

This function receives the orbital windows produced by the orbital engine.

It then gets the weather forecast once:

```python
weather = get_weather_forecast(
    site["latitude"],
    site["longitude"],
    days=16
)
```

This is more efficient than downloading a new forecast for every launch window.

---

# 32. Weather + Orbital Integration

For each orbital window, the code uses:

```python
window["peak"]
```

as the launch time.

It then calls:

```python
evaluate_weather_at_time(weather, launch_time)
```

The result is attached to the orbital window.

For example, an orbital window might become:

```python
{
    "id": "w21",
    "start": "2026-10-14T04:31:25+00:00",
    "peak": "2026-10-14T04:41:25+00:00",
    "end": "2026-10-14T04:51:25+00:00",
    "weather": "red",
    "weather_time": "2026-10-14T05:00:00+00:00",
    "checks": {
        "wind": "PASS",
        "rain": "PASS",
        "visibility": "PASS",
        "winds_aloft": "PASS",
        "thunderstorm": "PASS",
        "cloud_ceiling_proxy": "FAIL",
        "wind_gusts": "FAIL"
    }
}
```

This is the key point where the two systems become one launch-window engine.

---

# 33. Site ID Mapping

The orbital system and weather system use slightly different site IDs.

The combined engine solves this with:

```python
ORBITAL_TO_WEATHER_SITE = {
    "CapeCanaveral": "cape-canaveral",
    "NovaScotia": "nova-scotia"
}
```

So:

```text
Orbital system                 Weather system

CapeCanaveral       -------->  cape-canaveral
NovaScotia          -------->  nova-scotia
```

This allows each subsystem to keep its own naming conventions while still working together.

---

# 34. The Combined Launch Engine

The main integration function is:

```python
def generate_launch_windows_with_weather(
    launch_site,
    orbit_type,
    altitude=500_000,
    raan=30,
    vehicle_duration=480
):
```

This is effectively the public interface for the complete calculation.

It takes:

| Input | Meaning |
|---|---|
| `launch_site` | Launch location |
| `orbit_type` | LEO, SSO, or POLAR |
| `altitude` | Target orbital altitude |
| `raan` | Desired orbital-plane orientation |
| `vehicle_duration` | Approximate flight duration |

---

# 35. Step 1 — Calculate Orbital Windows

The function first calls:

```python
orbital_result = calculate_launch_windows(
    orbit_type,
    altitude,
    launch_site,
    raan,
    vehicle_duration
)
```

This produces:

```text
Orbit type
    |
    v
Inclination
    |
    v
Azimuth
    |
    v
Adjusted azimuth
    |
    v
RAAN intersections
    |
    v
Orbital launch windows
```

At this stage, the windows only represent orbital alignment.

Weather has not been considered yet.

---

# 36. Step 2 — Map the Weather Site

The combined engine uses:

```python
weather_site = ORBITAL_TO_WEATHER_SITE[launch_site]
```

This translates the orbital site ID into the weather API site ID.

---

# 37. Step 3 — Filter With Weather

The orbital windows are passed into:

```python
check_orbital_windows(weather_site, orbital_windows)
```

Now every orbital opportunity gets a weather result.

The final process is:

```text
Orbital window
      |
      v
What time is the peak?
      |
      v
What is the nearest weather forecast hour?
      |
      v
Check wind
      |
      v
Check rain
      |
      v
Check visibility
      |
      v
Check winds aloft
      |
      v
Check thunderstorms
      |
      v
Check cloud proxy
      |
      v
Check gusts
      |
      v
GREEN / RED / UNKNOWN
```

---

# 38. Final Combined Output

The combined engine returns information such as:

```python
{
    "launch_site": ...,
    "orbit_type": ...,
    "inclination": ...,
    "altitude": ...,
    "azimuth": ...,
    "adjusted_azimuth": ...,
    "windows": [...]
}
```

The important part is `windows`.

Each window contains both:

```text
Orbital information
+
Weather information
```

This lets the frontend display something meaningful to a mission planner.

---

# 39. Test Missions

The current test code uses two missions:

```python
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
```

This tests two different combinations:

```text
Cape Canaveral + LEO
Nova Scotia    + POLAR
```

For each mission, the program calculates the orbital windows and then filters them using weather.

---

# 40. Approved, Rejected, and Unavailable Windows

The test code separates the results into three categories:

```python
approved = [w for w in windows if w["weather"] == "green"]
rejected = [w for w in windows if w["weather"] == "red"]
unavailable = [w for w in windows if w["weather"] == "unknown"]
```

So the final result is effectively:

```text
All orbital windows
       |
       +-------------------+
       |                   |
       v                   v
 Weather available?      No data
       |                   |
   +---+---+               v
   |       |            UNKNOWN
  PASS    FAIL
   |       |
   v       v
 GREEN    RED
```

---

# 41. Selecting the Next Approved Window

The test program uses:

```python
approved[0]
```

as the next weather-approved window.

This assumes the generated windows are already chronological, which they are because `get_window_times()` searches forward in time.

Therefore, the first green window represents the first available window in the generated list that passes the current weather filters.

---

# 42. Example End-to-End Mission

Suppose the user selects:

```text
Launch site: Cape Canaveral
Orbit: LEO
Altitude: 500 km
RAAN: 30°
Vehicle duration: 480 seconds
```

The system works like this:

### Step 1 — Determine orbital parameters

LEO corresponds to:

```text
Inclination = 45.1°
```

### Step 2 — Calculate azimuth

The system uses the Cape Canaveral latitude and the 45.1° inclination.

### Step 3 — Calculate orbital-plane intersections

The RAAN and inclination determine where the orbital plane crosses the launch site's latitude.

### Step 4 — Calculate future alignment times

GMST and Earth's rotation are used to determine when Cape Canaveral aligns with the desired orbital plane.

### Step 5 — Create ±10-minute windows

Each alignment becomes:

```text
Start ---- Peak ---- End
 -10 min             +10 min
```

### Step 6 — Download weather

The engine requests the 16-day hourly forecast for Cape Canaveral.

### Step 7 — Check weather

For every orbital peak, it finds the nearest weather forecast hour.

### Step 8 — Filter the window

If every weather condition passes:

```text
GREEN
```

If any condition fails:

```text
RED
```

### Step 9 — Return the final window

The frontend can now display the window as a candidate launch opportunity.

---

# 43. Why the Architecture Is Useful

The biggest advantage of this architecture is that orbital mechanics and weather are separated.

```text
             Launch Engine
                  |
        +---------+---------+
        |                   |
        v                   v
 Orbital System        Weather System
        |                   |
        v                   v
  Candidate times      Weather status
        |                   |
        +---------+---------+
                  |
                  v
       Final launch windows
```

This makes it easier to change one system without rewriting the other.

For example, the weather system could later be changed from Open-Meteo to another provider without changing the orbital calculations.

Likewise, the orbital calculations could be improved without changing the weather filtering logic.

---

# 44. Current Important Limitations

The current implementation is a strong prototype, but there are several things to be aware of.

## 44.1 Weather is checked at the peak only

The code evaluates:

```python
window["peak"]
```

rather than checking the entire ±10-minute launch window.

Therefore, the current system means:

> “Weather is acceptable at the forecast time closest to the window peak.”

It does not yet mean:

> “Weather is acceptable for every moment inside the launch window.”

---

## 44.2 Forecast resolution is hourly

The weather API provides hourly values.

A launch could happen at:

```text
04:41 UTC
```

while the weather forecast used could be:

```text
05:00 UTC
```

because that is the closest available forecast point.

---

## 44.3 Cloud ceiling is a proxy

The code defines:

```python
MIN_CLOUD_CEILING_FT = 5000
```

but does not directly measure cloud ceiling in feet.

Instead, it uses low cloud cover as a proxy.

This should be described honestly when presenting the project.

---

## 44.4 `altitude` is currently mostly metadata

The altitude is passed through the launch-engine functions and returned in the result.

The current RAAN/window calculations do not use altitude to change the launch-window timing.

A future orbital-mechanics implementation could use altitude in additional calculations.

---

## 44.5 Adjusted azimuth has a unit issue

The current code calculates:

```python
azimuth - EARTH_ROTATION_RATE * vehicleDuration
```

where the first value is degrees and the second is radians.

A future version should convert the rotation adjustment to the same unit as the azimuth before subtracting.

---

## 44.6 Weather thresholds are simplified project rules

The current thresholds are useful for the hackathon prototype, but they should not be interpreted as a complete real-world launch safety system.

A production system would need much more detailed weather, vehicle, range-safety, and regulatory constraints.

---

# 45. Current End-to-End Architecture

The complete system can be summarized as:

```text
                         USER INPUT
                             |
                             v
              +---------------------------+
              | Mission Configuration     |
              |---------------------------|
              | Launch Site               |
              | Orbit Type                |
              | Altitude                  |
              | RAAN                      |
              | Vehicle Duration           |
              +-------------+-------------+
                            |
                            v
              +---------------------------+
              | calculate_launch_windows  |
              +-------------+-------------+
                            |
                            v
              +---------------------------+
              | lib_Calculations.py       |
              |---------------------------|
              | Inclination               |
              | Azimuth                   |
              | Adjusted Azimuth          |
              | Plane Intersections       |
              | GMST                      |
              | Earth Rotation            |
              | Launch Windows            |
              +-------------+-------------+
                            |
                            v
                  ORBITAL WINDOWS
                            |
                            v
              +---------------------------+
              | weatherApi.py             |
              +-------------+-------------+
                            |
                            v
                  Open-Meteo Forecast
                            |
                            v
              +---------------------------+
              | Weather Evaluation        |
              |---------------------------|
              | Surface Wind              |
              | Rain                      |
              | Visibility                |
              | Winds Aloft               |
              | Thunderstorms             |
              | Cloud Proxy               |
              | Wind Gusts                |
              +-------------+-------------+
                            |
                            v
                  GREEN / RED / UNKNOWN
                            |
                            v
              +---------------------------+
              | Combined Launch Windows   |
              +-------------+-------------+
                            |
                            v
                       FRONTEND/UI
```

---

# 46. Simple Explanation for a Presentation

If you need to explain the project quickly to a judge, you can describe it as:

> “Our launch-window engine has two stages. First, we use orbital mechanics to determine when the launch site aligns with the requested orbital plane. That gives us candidate launch windows. Then we take those candidate windows and run them through a weather filter using Open-Meteo. We check wind, gusts, rain, visibility, winds aloft, thunderstorms, and cloud conditions. The result is a list of launch windows that are not only orbital opportunities, but also pass our current weather requirements.”

---

# 47. One-Sentence Summary of Each File

### `lib_Calculations.py`

**Figures out the orbital geometry and when the launch site aligns with the requested orbital plane.**

### `Calculations.py`

**Turns those lower-level orbital calculations into a usable launch-window function.**

### `weatherApi.py`

**Gets hourly weather forecasts and determines whether each orbital window passes the project's weather requirements.**

### Combined launch engine

**Connects the orbital windows to the weather results and produces the final list of usable launch opportunities.**

---

# 48. Final Mental Model

The easiest way to remember the whole system is:

```text
ORBIT
  |
  | “When can we physically launch into this orbit?”
  v
Candidate Windows
  |
  | “Is the weather acceptable then?”
  v
WEATHER
  |
  v
GREEN / RED / UNKNOWN
  |
  v
FINAL LAUNCH WINDOWS
```

In other words:

**Orbital mechanics tells us WHEN a launch is possible. Weather filtering tells us WHETHER that opportunity currently meets our project requirements.**
