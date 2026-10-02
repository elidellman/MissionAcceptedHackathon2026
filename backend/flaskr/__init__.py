import os

from flask import Flask, jsonify


def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)

    @app.route('/api/test')
    def test_endpoint():
        return jsonify({
            'message': 'This backend was created using Flask, Created by Eli, Ely, Oliver, Hazem, Jeremy, Jeremiah ',
            'status': 'ok'
        })

    # a simple page that says hello
    @app.route('/hello')
    def hello():
        return 'Hello, World!'

    return app