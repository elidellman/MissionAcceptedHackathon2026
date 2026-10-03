import math
import os
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, request
from backend.Calculations import calculate_launch_windows
from backend.lib_Calculations import LaunchSites, OrbitTypes, get_plane_intersections
from backend.weather import rate_windows
from backend.debris import screen, screen_path


# ─────────────────────────────────────────────────────────────────────────────
# Frontend ↔ backend names
# The frontend (frontend/src/api/missionApi.js) uses these ids and labels;
# the calculation code uses the names on the right.
# ─────────────────────────────────────────────────────────────────────────────
SITES = {
    "cape-canaveral": {"key": "CapeCanaveral", "name": "Cape Canaveral SLC-40"},
    "nova-scotia": {"key": "SpacePort", "name": "Spaceport Nova Scotia"},
}
ORBITS = {"LEO": "LEO", "Polar": "POLAR", "SSO": "SSO"}  # frontend label → OrbitTypes key


def site_json(site_id):
    key = SITES[site_id]["key"]
    return {
        "id": site_id,
        "name": SITES[site_id]["name"],
        "lat": LaunchSites[key]["latitude"],
        "lon": LaunchSites[key]["longitude"],
    }


def iso_utc(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def error(message, status=400):
    return jsonify({"error": message}), status


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)

    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )

    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        app.config.from_mapping(test_config)

    os.makedirs(app.instance_path, exist_ok=True)

    @app.route('/api/test')
    def test_endpoint():
        return jsonify({
            'message': 'This backend was created using Flask, Created by Eli, Ely, Oliver, Hazem, Jeremy',
            'status': 'ok'
        })

    # -------------------------
    # LAUNCH SITES
    # GET /api/launch-sites
    # -------------------------
    @app.route('/api/launch-sites')
    def launch_sites():
        return jsonify({"sites": [site_json(site_id) for site_id in SITES]})

    # -------------------------
    # LAUNCH WINDOWS (used by the Mission Control page)
    # GET /api/launch-windows?site_id=cape-canaveral&orbit=SSO&altitude_km=700&days=7
    #     optional advanced settings: &raan=30&vehicle_duration=480
    # -------------------------
    @app.route('/api/launch-windows', methods=['GET'])
    def launch_windows_for_frontend():
        site_id = request.args.get('site_id')
        orbit = request.args.get('orbit')
        if site_id not in SITES:
            return error(f"Unknown site_id '{site_id}'. Use one of: {', '.join(SITES)}")
        if orbit not in ORBITS:
            return error(f"Unknown orbit '{orbit}'. Use one of: {', '.join(ORBITS)}")

        try:
            altitude_km = float(request.args.get('altitude_km', 500))
            days = max(1, min(16, int(request.args.get('days', 7))))
            raan = request.args.get('raan', type=float)
            vehicle_duration = request.args.get('vehicle_duration', type=float)
        except ValueError:
            return error("altitude_km and days must be numbers")

        site_key = SITES[site_id]["key"]
        orbit_key = ORBITS[orbit]

        result = calculate_launch_windows(
            orbit_type=orbit_key,
            altitude=altitude_km * 1000,  # calculation code works in metres
            launch_site=site_key,
            raan=raan,
            vehicle_duration=vehicle_duration,
        )
        inclination = result["inclination"]

        # A site can only launch directly into an orbit whose plane passes over it.
        # get_plane_intersections returns None when it never does (e.g. Nova Scotia → LEO 45.1°).
        reachable = get_plane_intersections(site_key, inclination, 0) is not None

        now = datetime.now(timezone.utc)
        horizon = now + timedelta(days=days)
        upcoming = [w for w in result["windows"] if now <= w["start"] < horizon] if reachable else []

        site = site_json(site_id)
        weather = rate_windows(site["lat"], site["lon"], [w["start"] for w in upcoming])

        windows = []
        for w, rating in zip(upcoming, weather):
            window = {
                # Everything the trajectory endpoint needs is packed into the id
                "id": f"{site_id}_{orbit}_{int(altitude_km)}_{w['start'].strftime('%Y%m%dT%H%M%S')}",
                "opens_at": iso_utc(w["start"]),
                "duration_min": round((w["end"] - w["start"]).total_seconds() / 60),
                "weather": rating,
            }
            if "peak" in w:
                window["peak_at"] = iso_utc(w["peak"])

            if "insertion" in w:
                window["insertion_at"] = iso_utc(w["insertion"])
            windows.append(window)

        return jsonify({
            "mission": {
                "name": f"{orbit} mission",
                "vehicle": "Generic Medium-Lift",
                "launch_site": site,
                "target_orbit": orbit,
                "inclination_deg": inclination,
                "altitude_km": altitude_km,
                "azimuth_deg": result["azimuth"],
                "reachable": reachable,
                "raan_deg": raan,
                "vehicle_duration_sec": vehicle_duration or 0,
            },
            "windows": windows,
        })

    # -------------------------
    # TRAJECTORY for one window (simplified ascent, not full physics)
    # GET /api/launch-windows/<window_id>/trajectory
    # -------------------------
    @app.route('/api/launch-windows/<window_id>/trajectory')
    def trajectory(window_id):
        try:
            site_id, orbit, altitude_km, _ = window_id.split('_')
            site = site_json(site_id)
            altitude_km = float(altitude_km)
            inclination = OrbitTypes[ORBITS[orbit]]["inclination"]
        except (ValueError, KeyError):
            return error(f"Unknown window id '{window_id}'", 404)

        # Launch heading from north: sin(Az) = cos(i) / cos(lat)  (clamped if not directly reachable)
        lat0, lon0 = math.radians(site["lat"]), math.radians(site["lon"])
        ratio = max(-1.0, min(1.0, math.cos(math.radians(inclination)) / math.cos(lat0)))
        heading = math.asin(ratio)
        if inclination > 90:  # retrograde orbits (SSO) launch south-ish, e.g. Florida → ~189°
            heading = math.pi - heading

        points = []
        downrange_km = 2000  # roughly where a rocket reaches orbit
        for step in range(61):  # 10 s apart, 10 minutes
            f = step / 60
            d = (downrange_km * f) / 6371  # angular distance travelled
            lat = math.asin(math.sin(lat0) * math.cos(d) + math.cos(lat0) * math.sin(d) * math.cos(heading))
            lon = lon0 + math.atan2(
                math.sin(heading) * math.sin(d) * math.cos(lat0),
                math.cos(d) - math.sin(lat0) * math.sin(lat),
            )
            points.append({
                "t_sec": step * 10,
                "lat": math.degrees(lat),
                "lon": (math.degrees(lon) + 540) % 360 - 180,
                "alt_km": altitude_km * math.sin(f * math.pi / 2),
            })

        return jsonify({"window_id": window_id, "points": points})

    # -------------------------
    # LAUNCH WINDOWS (original POST version, kept for scripts / testing)
    # -------------------------
    @app.route('/api/launch-windows', methods=['POST'])
    def launch_windows():
        data = request.get_json()

        orbit_type = data.get('orbit_type')
        altitude = data.get('altitude')
        launch_site = data.get('launch_site')

        # Optional advanced parameters
        raan = data.get('raan')
        vehicle_duration = data.get('vehicle_duration')

        windows = calculate_launch_windows(
            orbit_type=orbit_type,
            altitude=altitude,
            launch_site=launch_site,
            raan=raan,
            vehicle_duration=vehicle_duration
        )

        return jsonify({
            'windows': windows
        })

    # -------------------------
    # DEBRIS CHECK (single point)
    # -------------------------
    @app.get('/api/debris')
    def debris_check():
        try:
            lat = float(request.args['lat'])
            lon = float(request.args['lon'])
            alt_km = float(request.args['alt_km'])
            when = datetime.fromisoformat(request.args['time'].replace('Z', '+00:00'))
            radius = float(request.args.get('radius_km', 10))
        except (KeyError, ValueError):
            return jsonify(error='need lat, lon, alt_km, time (ISO UTC)'), 400
        return jsonify(screen(lat, lon, alt_km, when, radius))

    # -------------------------
    # DEBRIS CHECK (whole ascent path, used by the Simulate button)
    # POST /api/debris/path-check
    # -------------------------
    @app.post('/api/debris/path-check')
    def debris_path_check():
        data = request.get_json(silent=True) or {}
        try:
            start = datetime.fromisoformat(data['start'].replace('Z', '+00:00'))
            points = [{k: float(p[k]) for k in ('t_sec', 'lat', 'lon', 'alt_km')} for p in data['points']]
            radius = float(data.get('radius_km', 10))
        except (KeyError, ValueError, TypeError, AttributeError):
            return jsonify(error='need start (ISO UTC) and points [{t_sec, lat, lon, alt_km}]'), 400
        if len(points) < 2:
            return jsonify(error='need at least 2 points'), 400
        return jsonify(screen_path(points, start, radius))

    @app.route('/hello')
    def hello():
        return 'Hello, World!'

    return app