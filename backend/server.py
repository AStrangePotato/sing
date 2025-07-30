import os
import subprocess
import uuid
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import numpy as np
import librosa

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
VOCALS_FOLDER = "vocals" 
ALLOWED_EXTENSIONS = {'mp3'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VOCALS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['VOCALS_FOLDER'] = VOCALS_FOLDER

# --- Your pitch extraction functions ---
def get_volume_decibel(rms):
    return 20 * np.log10(rms + 1e-10)

def auto_correlate(buf, sample_rate, min_volume_db=-55.0):
    SIZE = len(buf)
    rms = np.sqrt(np.mean(buf**2))
    decibel = get_volume_decibel(rms)
    if decibel < min_volume_db:
        return -1

    thres = 0.2
    r1, r2 = 0, SIZE - 1
    for i in range(SIZE // 2):
        if abs(buf[i]) < thres:
            r1 = i
            break
    for i in range(1, SIZE // 2):
        if abs(buf[SIZE - i]) < thres:
            r2 = SIZE - i
            break

    sliced = buf[r1:r2]
    SIZE = len(sliced)
    if SIZE < 2:
        return -1

    c = np.zeros(SIZE)
    for i in range(SIZE):
        c[i] = np.sum(sliced[:SIZE - i] * sliced[i:])

    d = 0
    while d + 1 < SIZE and c[d] > c[d + 1]:
        d += 1
        

    maxval = -np.inf
    maxpos = -1
    for i in range(d, SIZE):
        if c[i] > maxval:
            maxval = c[i]
            maxpos = i

    if maxpos <= 1 or maxpos + 1 >= SIZE:
        return -1

    x1, x2, x3 = c[maxpos - 1], c[maxpos], c[maxpos + 1]
    a = (x1 + x3 - 2 * x2) / 2.0
    b = (x3 - x1) / 2.0
    T0 = maxpos if a == 0 else maxpos - b / (2 * a)
    if T0 <= 0:
        return -1

    return sample_rate / T0

def extract_pitch_frames(mp3_path, buffer_size=4096, sample_rate=44100):
    y, sr = librosa.load(mp3_path, sr=sample_rate, mono=True)
    pitches = []

    hop_size = buffer_size  # non-overlapping frames
    num_frames = (len(y) - buffer_size) // hop_size

    for i in range(num_frames):
        start = i * hop_size
        frame = y[start:start + buffer_size]
        pitch = auto_correlate(frame, sample_rate)

        if pitch > 0:
            midi = int(round(librosa.hz_to_midi(pitch)))
            time = round(start / sample_rate, 3)
            pitches.append({
                "time": time,
                "pitch": midi
            })

    duration_sec = len(y) / sample_rate
    return pitches, duration_sec

def build_song_data(mp3_path, title="Unknown Title", artist="Unknown Artist"):
    pitches, duration_sec = extract_pitch_frames(mp3_path)
    return {
        "id": os.path.splitext(os.path.basename(mp3_path))[0],
        "title": title,
        "artist": artist,
        "duration": "{:02d}:{:02d}".format(int(duration_sec) // 60, int(duration_sec) % 60),
        "filename": f"http://localhost:5000/uploads/{os.path.basename(mp3_path)}",
        "pitches": pitches
    }

# Helper to check extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/process', methods=['POST'])
def process_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        # Save uploaded file
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())[:8]
        saved_filename = f"{unique_id}_{filename}"
        saved_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
        file.save(saved_path)

        # Run Demucs to separate vocals
        # This assumes Demucs CLI is installed and in PATH
        # Vocal output will be in VOCALS_FOLDER/<saved_filename>_vocals.wav or similar
        demucs_cmd = [
            "demucs",
            "-n", "htdemucs",
            "-o", VOCALS_FOLDER,
            saved_path
        ]
        subprocess.run(demucs_cmd, check=True)

        # Locate the vocal output file (Demucs outputs to VOCALS_FOLDER/<model>/<filename>/vocals.wav)
        # So path: VOCALS_FOLDER/htdemucs/<saved_filename_without_ext>/vocals.wav
        vocal_dir = os.path.join(app.config['VOCALS_FOLDER'], 'htdemucs', os.path.splitext(saved_filename)[0])
        vocal_path = os.path.join(vocal_dir, "vocals.wav")

        if not os.path.exists(vocal_path):
            return jsonify({"error": "Vocal extraction failed"}), 500

        # Build song data from vocals
        song_data = build_song_data(vocal_path, title="Uploaded Song", artist="Unknown Artist")

        return jsonify(song_data)

    else:
        return jsonify({"error": "Invalid file type"}), 400

if __name__ == "__main__":
    app.run(debug=True)
