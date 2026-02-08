# Drum Analyzer

Classifies drum samples as **Kick**, **Snare**, or **Hi-Hat** and computes **BASS**, **MID**, and **HIGH** frequency bands. Uses Librosa for feature extraction; lightweight for real-time use in a music production workflow.

## Setup

```bash
pip install -r requirements.txt
```

Installs: `librosa`, `numpy`, `scikit-learn`, `soundfile`, `flask`.

## CLI

**Single file:**

```bash
python drum_analyzer.py path/to/your_kick.wav
# e.g. Kick — BASS 55.2% MID 30.1% HIGH 14.7%

python drum_analyzer.py path/to/sample.wav --json
```

**Batch folder (e.g. sort a kit):**

```bash
python drum_analyzer.py path/to/drum_samples_folder --batch
python drum_analyzer.py path/to/drum_samples_folder --batch --json
```

## REST API (optional)

Start the server from the project root:

```bash
python server_drum_api.py
```

- **POST** `/analyze` — multipart form with `file` = your WAV/OGG.
- **GET** `/analyze?path=assets/music/sample.wav` — analyze by relative path.
- **GET** `/analyze?folder=assets/music/MyKits` — analyze all audio in folder (returns `samples` array).

### Call from your app (fetch)

```javascript
// Single file upload
const form = new FormData();
form.append('file', audioFile); // File from <input type="file"> or drag-drop
const res = await fetch('http://localhost:5000/analyze', { method: 'POST', body: form });
const result = await res.json();
// result: { drum_type: "Kick", BASS: "55.2%", MID: "30.1%", HIGH: "14.7%", features: [...] }

// By path (same origin or CORS allowed)
const res = await fetch('/analyze?path=assets/music/kick01.wav');
const result = await res.json();
```

Use `result.drum_type` and `result.BASS` / `result.MID` / `result.HIGH` to drive your UI (e.g. table of classified samples or BASS/MID/HIGH readouts).

## Training a better classifier

1. Collect 100+ labeled samples per class (Kick, Snare, Hi-Hat).
2. Extract features for each: `analyze_drum(path)["features"]` and keep labels.
3. Fit a RandomForest (or other classifier):

```python
from sklearn.ensemble import RandomForestClassifier
from drum_analyzer import analyze_drum

# train_paths = [(path, "Kick"), (path, "Snare"), ...]
# X = np.array([analyze_drum(p)[\"features\"] for p, _ in train_paths])
# y = [label for _, label in train_paths]
# clf = RandomForestClassifier().fit(X, y)
# Then: analyze_drum(new_path, classifier=clf)
```

Datasets: e.g. [DLDC / DrumClassifer-CNN-LSTM](https://github.com/faraway1nspace/DrumClassifer-CNN-LSTM).

## Band definitions

- **BASS**: &lt; 250 Hz  
- **MID**: 250 Hz – 4 kHz  
- **HIGH**: &gt; 4 kHz  

Rule-based logic: low centroid + dominant bass → Kick; high ZCR + strong mid → Snare; else Hi-Hat. Tweak thresholds in `drum_analyzer.py` or replace with a trained model.
