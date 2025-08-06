import numpy as np
import librosa
from flask import Flask, request, jsonify

app = Flask(__name__)

def get_volume_decibel(rms):
    return 20 * np.log10(rms + 1e-10)

def auto_correlate(buf, sample_rate, min_volume_db=50.0):
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

def extract_pitch_frames(file_stream, buffer_size=4096, sample_rate=44100):
    y, sr = librosa.load(file_stream, sr=sample_rate, mono=True)
    pitches = []
    hop_size = buffer_size
    num_frames = (len(y) - buffer_size) // hop_size

    for i in range(num_frames):
        start = i * hop_size
        frame = y[start:start + buffer_size]
        pitch = auto_correlate(frame, sample_rate)

        if pitch > 0:
            midi = int(round(librosa.hz_to_midi(pitch)))
            time = round(start / sample_rate, 3)
            pitches.append({"time": time, "pitch": midi})

    duration_sec = len(y) / sample_rate
    return pitches, duration_sec

@app.route("/process", methods=["POST"])
def process_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    pitches, duration = extract_pitch_frames(file)

    return jsonify({
        "duration": round(duration),
        "pitches": pitches
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)