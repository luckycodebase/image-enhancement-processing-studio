from flask import Flask, request, jsonify, send_file
import cv2
import numpy as np
from io import BytesIO
import zipfile
import os

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
ALLOWED = {"png", "jpg", "jpeg", "bmp", "webp"}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Vary"] = "Origin"
    return response

def process_image(image, operation):
    if operation == "grayscale":
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    if operation == "blur":
        return cv2.GaussianBlur(image, (15, 15), 0)
    if operation == "sharpen":
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        return cv2.filter2D(image, -1, kernel)
    if operation == "denoise":
        return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
    if operation == "edges":
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    if operation == "sepia":
        sepia = np.array([[0.272, 0.534, 0.131],
                          [0.349, 0.686, 0.168],
                          [0.393, 0.769, 0.189]])
        return np.clip(cv2.transform(image, sepia), 0, 255).astype(np.uint8)
    if operation == "warm":
        result = image.astype(np.float32)
        result[:, :, 2] = np.clip(result[:, :, 2] * 1.12 + 8, 0, 255)
        result[:, :, 0] = np.clip(result[:, :, 0] * 0.92, 0, 255)
        return result.astype(np.uint8)
    if operation == "cool":
        result = image.astype(np.float32)
        result[:, :, 0] = np.clip(result[:, :, 0] * 1.12 + 8, 0, 255)
        result[:, :, 2] = np.clip(result[:, :, 2] * 0.92, 0, 255)
        return result.astype(np.uint8)
    if operation == "vintage":
        result = cv2.applyColorMap(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), cv2.COLORMAP_BONE)
        return cv2.addWeighted(result, 0.75, image, 0.25, 0)
    raise ValueError("Unknown processing operation.")

@app.route("/")
def home():
    return app.send_static_file("index.html")

@app.route("/api/process", methods=["POST", "OPTIONS"])
def process():
    if request.method == "OPTIONS":
        return ("", 204)
    if "image" not in request.files:
        return jsonify({"error": "Please choose an image first."}), 400
    upload = request.files["image"]
    if not upload.filename or "." not in upload.filename:
        return jsonify({"error": "Please choose a valid image file."}), 400
    if upload.filename.rsplit(".", 1)[1].lower() not in ALLOWED:
        return jsonify({"error": "Use PNG, JPG, JPEG, BMP, or WEBP."}), 400
    try:
        raw = np.frombuffer(upload.read(), np.uint8)
        image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("The uploaded file is not a valid image.")
        if image.shape[0] > 4000 or image.shape[1] > 4000:
            return jsonify({"error": "Image dimensions must not exceed 4000 x 4000 pixels."}), 400
        result = process_image(image, request.form.get("operation", "grayscale"))
        ok, encoded = cv2.imencode(".png", result)
        if not ok:
            raise ValueError("Could not encode the processed image.")
        return send_file(BytesIO(encoded.tobytes()), mimetype="image/png",
                         download_name="processed-image.png")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Image processing error")
        return jsonify({"error": "Processing failed. Please try another image."}), 500

@app.route("/api/extract-frame", methods=["POST"])
def extract_frame():
    if "video" not in request.files:
        return jsonify({"error": "Please choose a video first."}), 400
    upload = request.files["video"]
    if not upload.filename:
        return jsonify({"error": "Please choose a valid video file."}), 400
    allowed_video_suffixes = {".mp4", ".webm", ".avi", ".mov", ".mkv", ".m4v"}
    suffix = os.path.splitext(upload.filename)[1].lower()
    if suffix not in allowed_video_suffixes:
        return jsonify({"error": "Use MP4, WEBM, AVI, MOV, MKV, or M4V video."}), 400
    try:
        import tempfile
        suffix = os.path.splitext(upload.filename)[1].lower() or ".mp4"
        temp_path = None
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
            temp.write(upload.read())
            temp_path = temp.name
        capture = cv2.VideoCapture(temp_path)
        if not capture.isOpened():
            os.unlink(temp_path)
            raise ValueError("The video could not be opened.")
        timestamp = float(request.form.get("timestamp", 0))
        if timestamp < 0:
            timestamp = 0
        fps = capture.get(cv2.CAP_PROP_FPS) or 30
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_number = min(max(int(timestamp * fps), 0), max(frame_count - 1, 0))
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ok, frame = capture.read()
        capture.release()
        os.unlink(temp_path)
        if not ok:
            raise ValueError("Could not extract a frame at that timestamp.")
        ok, encoded = cv2.imencode(".png", frame)
        if not ok:
            raise ValueError("Could not encode the extracted frame.")
        return send_file(BytesIO(encoded.tobytes()), mimetype="image/png",
                         download_name="extracted-frame.png")
    except (ValueError, TypeError) as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Video frame extraction error")
        return jsonify({"error": "Frame extraction failed."}), 500

@app.route("/api/batch-process", methods=["POST"])
def batch_process():
    files = request.files.getlist("images")
    operation = request.form.get("operation", "grayscale")
    if not files:
        return jsonify({"error": "Please choose at least one image."}), 400
    try:
        archive = BytesIO()
        processed_count = 0
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
            for upload in files:
                if not upload.filename or "." not in upload.filename:
                    continue
                if upload.filename.rsplit(".", 1)[1].lower() not in ALLOWED:
                    continue
                raw = np.frombuffer(upload.read(), np.uint8)
                image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
                if image is None:
                    continue
                result = process_image(image, operation)
                ok, encoded = cv2.imencode(".png", result)
                if ok:
                    name = os.path.splitext(upload.filename)[0] + "-processed.png"
                    output.writestr(name, encoded.tobytes())
                    processed_count += 1
        if processed_count == 0:
            return jsonify({"error": "No valid images could be processed."}), 400
        archive.seek(0)
        return send_file(archive, mimetype="application/zip",
                         download_name=f"{operation}-batch.zip", as_attachment=True)
    except Exception:
        app.logger.exception("Batch processing error")
        return jsonify({"error": "Batch processing failed."}), 500

@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "Maximum upload size is 500 MB."}), 413

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
