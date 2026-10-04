

import math
import os
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, request
from Calculations import calculate_launch_windows
from lib_Calculations import LaunchSites, OrbitTypes, get_plane_intersections
from weather import rate_windows
from debris import screen, screen_path
from flask_cors import CORS

# ─────────────────────────────────────────────────────────────────────────────
# Frontend ↔ backend names
# The frontend (frontend/src/api/missionApi.js) uses these ids and labels;
# the calculation code uses the names on the right.
# ─────────────────────────────────────────────────────────────────────────────
SITES = {
    "cape-canaveral": {
        "key": "CapeCanaveral",
        "name": "Cape Canaveral SLC-40"
    },

    "nova-scotia": {
        "key": "Nova-Scotia",
        "name": "Spaceport Nova Scotia"
    },
}

ORBITS = {
    "LEO": "LEO",
    "Polar": "POLAR",
    "SSO": "SSO"
}


def site_json(site_id):

    key = SITES[site_id]["key"]

    return {
        "id": site_id,
        "name": SITES[site_id]["name"],
        "lat": LaunchSites[key]["latitude"],
        "lon": LaunchSites[key]["longitude"],
    }


def iso_utc(dt):

    return dt.astimezone(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def error(message, status=400):

    return jsonify({
        "error": message
    }), status


def create_app(test_config=None):

    app = Flask(
        __name__,
        instance_relative_config=True
    )
    CORS(app, origins=["https://elidellman.github.io"])
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(
            app.instance_path,
            'flaskr.sqlite'
        ),
    )

    if test_config is None:

        app.config.from_pyfile(
            'config.py',
            silent=True
        )

    else:

        app.config.from_mapping(
            test_config
        )

    os.makedirs(
        app.instance_path,
        exist_ok=True
    )


    @app.route('/api/test')
    def test_endpoint():

        return jsonify({
            'message': 'This backend was created using Flask, Created by Eli, Ely, Oliver, Hazem, Jeremy',
            'status': 'ok'
        })


    @app.route(
        "/api/launch-windows/weather",
        methods=["POST"]
    )
    def launch_windows_with_weather():

        data = request.get_json()

        from integration import generate_launch_windows_with_weather

        result = generate_launch_windows_with_weather(
            launch_site=data["launch_site"],
            orbit_type=data["orbit_type"],
            altitude=data.get(
                "altitude",
                500000
            ),
            raan=data.get(
                "raan",
                30
            ),
            vehicle_duration=data.get(
                "vehicle_duration",
                480
            )
        )

        return jsonify(result)


    # -------------------------
    # LAUNCH SITES
    # GET /api/launch-sites
    # -------------------------

    @app.route('/api/launch-sites')
    def launch_sites():

        return jsonify({
            "sites": [
                site_json(site_id)
                for site_id in SITES
            ]
        })


    # -------------------------
    # LAUNCH WINDOWS
    #
    # GET /api/launch-windows
    #
    # Example:
    # /api/launch-windows?site_id=cape-canaveral&orbit=SSO&altitude_km=700&days=7
    #
    # Optional advanced settings:
    # &raan=30
    # &vehicle_duration=480
    # -------------------------

    @app.route(
        '/api/launch-windows',
        methods=['GET']
    )
    def launch_windows_for_frontend():

        site_id = request.args.get(
            'site_id'
        )

        orbit = request.args.get(
            'orbit'
        )


        # Check site

        if site_id not in SITES:

            return error(
                f"Unknown site_id '{site_id}'. "
                f"Use one of: {', '.join(SITES)}"
            )


        # Check orbit

        if orbit not in ORBITS:

            return error(
                f"Unknown orbit '{orbit}'. "
                f"Use one of: {', '.join(ORBITS)}"
            )


        # Read query parameters

        try:

            altitude_km = float(
                request.args.get(
                    'altitude_km',
                    500
                )
            )

            days = max(
                1,
                min(
                    16,
                    int(
                        request.args.get(
                            'days',
                            7
                        )
                    )
                )
            )

            raan = request.args.get(
                'raan',
                type=float
            )

            vehicle_duration = request.args.get(
                'vehicle_duration',
                type=float
            )

        except ValueError:

            return error(
                "altitude_km and days must be numbers"
            )


        # Convert frontend names to calculation names

        site_key = SITES[site_id]["key"]

        orbit_key = ORBITS[orbit]


        # Calculate orbital windows

        result = calculate_launch_windows(

            orbit_type=orbit_key,

            altitude=altitude_km * 1000,

            launch_site=site_key,

            raan=raan,

            vehicle_duration=vehicle_duration,
        )


        inclination = result["inclination"]


        # A site can only launch directly into an orbit
        # whose plane passes over it.
        #
        # get_plane_intersections returns None when
        # the orbit never passes over the launch site.

        reachable = (
            get_plane_intersections(
                site_key,
                inclination,
                0
            ) is not None
        )


        # Current time

        now = datetime.now(
            timezone.utc
        )

        horizon = (
            now +
            timedelta(
                days=days
            )
        )


        # Keep only upcoming windows

        if reachable:

            upcoming = [
                window
                for window in result["windows"]
                if now <= window["start"] < horizon
            ]

        else:

            upcoming = []


        # Get launch site information

        site = site_json(
            site_id
        )


        # Get weather ratings

        weather = rate_windows(
            site["lat"],
            site["lon"],
            [
                window["start"]
                for window in upcoming
            ]
        )


        # Build frontend windows

        windows = []


        for orbital_window, rating in zip(
            upcoming,
            weather
        ):

            window = {

                # Everything the trajectory endpoint
                # needs is packed into the id

                "id": (
                    f"{site_id}_"
                    f"{orbit}_"
                    f"{int(altitude_km)}_"
                    f"{orbital_window['start'].strftime('%Y%m%dT%H%M%S')}"
                ),

                "opens_at": iso_utc(
                    orbital_window["start"]
                ),

                "duration_min": round(
                    (
                        orbital_window["end"] -
                        orbital_window["start"]
                    ).total_seconds() / 60
                ),

                "weather": rating,
            }
            if "peak" in orbital_window:  # advanced (RAAN) mode has an exact alignment time
                window["peak_at"] = iso_utc(orbital_window["peak"])
            windows.append(window)

        return jsonify({

            "mission": {

                "name": (
                    f"{orbit} mission"
                ),

                "vehicle": (
                    "Generic Medium-Lift"
                ),

                "launch_site": site,

                "target_orbit": orbit,

                "inclination_deg": inclination,

                "altitude_km": altitude_km,

                "azimuth_deg": (
                    result["azimuth"]
                ),

                "reachable": reachable,
                "raan_deg": raan,
                "vehicle_duration_sec": vehicle_duration or 0,
            },

            "windows": windows,
        })


    # -------------------------
    # TRAJECTORY FOR ONE WINDOW
    #
    # Simplified ascent,
    # not full physics.
    #
    # GET:
    # /api/launch-windows/<window_id>/trajectory
    # -------------------------

    @app.route(
        '/api/launch-windows/<window_id>/trajectory'
    )
    def trajectory(window_id):

        try:
            site_id, orbit, altitude_km, _ = window_id.split('_')
            site = site_json(site_id)
            altitude_km = float(altitude_km)
            inclination = OrbitTypes[ORBITS[orbit]]["inclination"]
        except (ValueError, KeyError):
            return error(f"Unknown window id '{window_id}'", 404)

        # Launch heading from north:
        #
        # sin(Az) = cos(i) / cos(lat)
        #
        # Clamp the ratio so asin() doesn't
        # receive a value outside [-1, 1].

        lat0 = math.radians(
            site["lat"]
        )

        lon0 = math.radians(
            site["lon"]
        )


        ratio = max(
            -1.0,
            min(
                1.0,
                math.cos(
                    math.radians(
                        inclination
                    )
                )
                /
                math.cos(
                    lat0
                )
            )
        )


        heading = math.asin(
            ratio
        )


        # Retrograde orbits
        # such as SSO launch south-ish.

        if inclination > 90:

            heading = (
                math.pi -
                heading
            )


        points = []

        # Roughly where a rocket
        # reaches orbit.

        downrange_km = 2000


        # 61 points:
        # 0 through 60
        # 10 seconds apart
        # = 10 minutes

        for step in range(61):

            progress = step / 60

            angular_distance = (
                downrange_km * progress
            ) / 6371


            lat = math.asin(

                math.sin(lat0)
                *
                math.cos(angular_distance)

                +

                math.cos(lat0)
                *
                math.sin(angular_distance)
                *
                math.cos(heading)
            )


            lon = (
                lon0
                +
                math.atan2(

                    math.sin(heading)
                    *
                    math.sin(angular_distance)
                    *
                    math.cos(lat0),

                    math.cos(angular_distance)
                    -
                    math.sin(lat0)
                    *
                    math.sin(lat)
                )
            )


            points.append({

                "t_sec":
                    step * 10,

                "lat":
                    math.degrees(lat),

                "lon":
                    (
                        math.degrees(lon)
                        +
                        540
                    )
                    % 360
                    -
                    180,

                "alt_km":
                    altitude_km
                    *
                    math.sin(
                        progress *
                        math.pi /
                        2
                    ),
            })


        return jsonify({

            "window_id":
                window_id,

            "points":
                points

        })


    # -------------------------
    # LAUNCH WINDOWS
    # Original POST version
    #
    # Kept for scripts/testing.
    # -------------------------

    @app.route(
        '/api/launch-windows',
        methods=['POST']
    )
    def launch_windows():

        data = request.get_json()


        orbit_type = data.get(
            'orbit_type'
        )

        altitude = data.get(
            'altitude'
        )

        launch_site = data.get(
            'launch_site'
        )


        # Optional advanced parameters

        raan = data.get(
            'raan'
        )

        vehicle_duration = data.get(
            'vehicle_duration'
        )


        windows = calculate_launch_windows(

            orbit_type=orbit_type,

            altitude=altitude,

            launch_site=launch_site,

            raan=raan,

            vehicle_duration=vehicle_duration

        )


        return jsonify({

            'windows':
                windows

        })


    # -------------------------
    # DEBRIS CHECK
    # Single point
    # -------------------------

    @app.get(
        '/api/debris'
    )
    def debris_check():

        try:

            lat = float(
                request.args['lat']
            )

            lon = float(
                request.args['lon']
            )

            alt_km = float(
                request.args['alt_km']
            )

            when = datetime.fromisoformat(
                request.args['time'].replace(
                    'Z',
                    '+00:00'
                )
            )

            radius = float(
                request.args.get(
                    'radius_km',
                    10
                )
            )

        except (
            KeyError,
            ValueError
        ):

            return jsonify(
                error=(
                    'need lat, lon, alt_km, '
                    'time (ISO UTC)'
                )
            ), 400


        return jsonify(
            screen(
                lat,
                lon,
                alt_km,
                when,
                radius
            )
        )


    # -------------------------
    # DEBRIS CHECK
    # Whole ascent path
    #
    # Used by the Simulate button.
    #
    # POST:
    # /api/debris/path-check
    # -------------------------

    @app.post(
        '/api/debris/path-check'
    )
    def debris_path_check():

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )


        try:

            start = datetime.fromisoformat(
                data['start'].replace(
                    'Z',
                    '+00:00'
                )
            )


            points = [

                {
                    field: float(point[field])
                    for field in (
                        't_sec',
                        'lat',
                        'lon',
                        'alt_km'
                    )
                }

                for point in data['points']

            ]


            radius = float(
                data.get(
                    'radius_km',
                    10
                )
            )


        except (
            KeyError,
            ValueError,
            TypeError,
            AttributeError
        ):

            return jsonify(
                error=(
                    'need start (ISO UTC) '
                    'and points '
                    '[{t_sec, lat, lon, alt_km}]'
                )
            ), 400


        if len(points) < 2:

            return jsonify(
                error='need at least 2 points'
            ), 400


        return jsonify(
            screen_path(
                points,
                start,
                radius
            )
        )


    @app.route('/hello')
    def hello():

        return 'Hello, World!'


    return app