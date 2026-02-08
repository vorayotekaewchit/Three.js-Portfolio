"""
Optional Flask API for drum analyzer. Run from project root:

  pip install flask
  python server_drum_api.py

  Then POST audio to http://localhost:5000/analyze (multipart form: file=your.wav)
  Or GET  http://localhost:5000/analyze?path=assets/music/sample.wav (path relative to project)
"""
from pathlib import Path

from flask import Flask, jsonify, request

from drum_analyzer import analyze_drum, analyze_folder

app = Flask(__name__)
PROJECT_ROOT = Path(__file__).resolve().parent


@app.route("/analyze", methods=["GET", "POST"])
def analyze():
    if request.method == "POST":
        f = request.files.get("file")
        if not f:
            return jsonify({"error": "No file in form (use key 'file')"}), 400
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=Path(f.filename).suffix, delete=False) as tmp:
                f.save(tmp.name)
                result = analyze_drum(tmp.name)
            Path(tmp.name).unlink(missing_ok=True)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # GET: ?path=relative/path/to/sample.wav or ?folder=relative/path/to/folder
    path_arg = request.args.get("path")
    folder_arg = request.args.get("folder")
    if path_arg:
        full = PROJECT_ROOT / path_arg
        if not full.exists():
            return jsonify({"error": f"File not found: {path_arg}"}), 404
        try:
            return jsonify(analyze_drum(full))
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    if folder_arg:
        full = PROJECT_ROOT / folder_arg
        if not full.is_dir():
            return jsonify({"error": f"Folder not found: {folder_arg}"}), 404
        try:
            results = analyze_folder(full)
            return jsonify({"samples": results, "count": len(results)})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"usage": "POST multipart file=... or GET ?path=... or ?folder=..."}), 400


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
