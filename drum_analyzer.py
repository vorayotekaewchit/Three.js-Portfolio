"""
Drum analyzer: classifies audio samples as Kick, Snare, or Hi-Hat
and computes BASS, MID, HIGH frequency bands. Lightweight for real-time
music production workflow. Uses Librosa for feature extraction.
"""
import argparse
import json
from pathlib import Path

import librosa
import numpy as np

# Optional: for trained RandomForest classifier (fit on labeled samples)
try:
    from sklearn.ensemble import RandomForestClassifier
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def analyze_drum(file_path, classifier=None):
    """
    Analyze a drum sample: extract BASS/MID/HIGH bands and classify as Kick, Snare, or Hi-Hat.

    Args:
        file_path: Path to WAV/OGG file.
        classifier: Optional fitted sklearn classifier (e.g. RandomForestClassifier).
                    If None, uses rule-based classification.

    Returns:
        dict with drum_type, BASS, MID, HIGH (percentages), and features (for ML training).
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    y, sr = librosa.load(str(file_path), sr=22050)

    # STFT for spectral features
    S = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)

    # Frequency bands: BASS <250Hz, MID 250–4kHz, HIGH >4kHz
    bass_mask = freqs < 250
    mid_mask = (freqs >= 250) & (freqs < 4000)
    high_mask = freqs >= 4000

    bass_power = np.mean(S[bass_mask, :])
    mid_power = np.mean(S[mid_mask, :])
    high_power = np.mean(S[high_mask, :])

    total_power = bass_power + mid_power + high_power
    if total_power <= 0:
        total_power = 1.0
    bass_pct = (bass_power / total_power) * 100
    mid_pct = (mid_power / total_power) * 100
    high_pct = (high_power / total_power) * 100

    # Drum classification features
    centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    rolloff = float(librosa.feature.spectral_rolloff(y=y, sr=sr).mean())
    zcr = float(librosa.feature.zero_crossing_rate(y).mean())
    rms = float(librosa.feature.rms(y=y).mean())
    features = np.array([centroid, rolloff, zcr, rms, bass_pct, mid_pct, high_pct]).reshape(1, -1)

    # Classification: trained model or rule-based
    if classifier is not None and HAS_SKLEARN:
        label = classifier.predict(features)[0]
        drum_type = str(label)
    else:
        if centroid < 800 and bass_pct > 40:
            drum_type = "Kick"
        elif zcr > 0.1 and mid_pct > 35:
            drum_type = "Snare"
        else:
            drum_type = "Hi-Hat"

    return {
        "drum_type": drum_type,
        "BASS": f"{bass_pct:.1f}%",
        "MID": f"{mid_pct:.1f}%",
        "HIGH": f"{high_pct:.1f}%",
        "features": features[0].tolist(),
        "file": file_path.name,
    }


def analyze_folder(folder_path, classifier=None, extensions=None):
    """Analyze all audio files in a folder. Returns list of results."""
    if extensions is None:
        extensions = {".wav", ".ogg", ".flac"}
    folder = Path(folder_path)
    if not folder.is_dir():
        raise NotADirectoryError(f"Not a directory: {folder}")
    results = []
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() in extensions:
            try:
                r = analyze_drum(path, classifier=classifier)
                results.append(r)
            except Exception as e:
                results.append({"file": path.name, "error": str(e)})
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Analyze drum samples: BASS/MID/HIGH bands and Kick/Snare/Hi-Hat classification."
    )
    parser.add_argument(
        "path",
        type=str,
        help="Path to a single WAV/OGG file or a folder of samples",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON (for piping or API)",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Treat path as a folder and analyze all audio files inside",
    )
    args = parser.parse_args()
    path = Path(args.path)

    if args.batch or path.is_dir():
        results = analyze_folder(path)
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            for r in results:
                if "error" in r:
                    print(f"  {r['file']}: ERROR {r['error']}")
                else:
                    print(f"  {r['file']}: {r['drum_type']} — BASS {r['BASS']} MID {r['MID']} HIGH {r['HIGH']}")
    else:
        result = analyze_drum(path)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(
                f"{result['drum_type']} — BASS {result['BASS']} MID {result['MID']} HIGH {result['HIGH']}"
            )


if __name__ == "__main__":
    main()
