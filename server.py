import os

from app import create_app


app = create_app()


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "0") in {"1", "true", "True"}
    app.run(debug=debug)
