import os

from flask import Flask, jsonify, request
from Calculations import calculate_launch_windows


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
            'message': 'This backend was created using Flask, Created by Eli, Ely, Oliver, Hazem, Jeremy, Jeremiah',
            'status': 'ok'
        })

    # -------------------------
    # LAUNCH WINDOWS
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

    @app.route('/hello')
    def hello():
        return 'Hello, World!'

    return app