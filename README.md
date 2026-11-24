# PixelLab - Image Enhancement and Processing Studio

PixelLab is a browser-based image editing workspace built with Python, Flask, OpenCV, NumPy, HTML, CSS, and JavaScript. It supports live image adjustments, image transforms, creative effects, batch processing, video frame extraction, webcam capture, and PNG downloads.

## Features

### Image editing
- Live brightness and contrast adjustments
- Exposure control
- Shadow, midtone, and highlight curve adjustments
- Temperature, tint, and saturation controls
- Film grain, vignette, and texture effects
- Responsive live canvas preview
- Before-and-after comparison slider
- Undo and redo with up to 30 edit states
- Reset adjustments and reset all edits

### Resizing, rotation, and cropping
- Resize images by exact pixel width and height
- Optional aspect-ratio locking while resizing
- Rotate images 90 degrees left or right
- Exact pixel cropping
- Freehand crop selection
- Cropping ratios: 1:1, 4:3, 3:2, 16:9, 9:16, and 5:4

### Filters
- Original
- Grayscale
- Blur
- Sharpen
- Noise reduction
- Edge detection
- Sepia
- Warm
- Cool
- Vintage

### Additional tools
- Batch processing with original and processed thumbnails
- Download processed batch images as a ZIP archive
- Extract a PNG frame from an uploaded video
- Capture and edit an image from a webcam
- Upload images by file picker or drag and drop
- Delete uploaded images, videos, and batch selections
- Download the edited image as PNG
- Persistent light and dark themes

## Supported files

**Images**
- PNG
- JPG/JPEG
- WEBP
- BMP

**Images selected in the browser**
- Maximum size: 10 MB
- Maximum dimensions: 4000 x 4000 pixels

**Video**
- MP4
- WEBM
- AVI
- MOV
- MKV
- M4V

Video uploads support the server's 500 MB request limit.

## Project structure

```text
image-enhancement-processing-studio/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
└── static/
    ├── index.html
    ├── style.css
    └── app.js
```

## Requirements

- Python 3.10 or newer
- 64-bit Python recommended
- OpenCV-compatible video codecs for frame extraction
- A modern web browser
- Webcam access requires permission and localhost or HTTPS

## Setup on Windows

1. Clone or download the project.
2. Open the project directory in VS Code.
3. Open a terminal and create a virtual environment:

```powershell
py -m venv venv
```

4. Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use Command Prompt:

```cmd
venv\Scripts\activate.bat
```

5. Install dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

6. Start the Flask server:

```powershell
python app.py
```

7. Open:

```text
http://127.0.0.1:5000
```

Do not open `static/index.html` directly. The Flask server is required for filter, batch, and video APIs.

## How to use

1. Upload an image or drag it into the upload area.
2. Use Adjustments for brightness, contrast, exposure, tone curves, color grading, grain, vignette, and texture.
3. Use Filters or Color Filters to apply an image treatment.
4. Use Resize and Rotate & Crop to transform the image.
5. Drag over the live preview while crop selection is enabled to crop freely or with a fixed ratio.
6. Use Compare to view the original and edited images side by side.
7. Use Undo or Redo to move through completed edits.
8. Use Video Frame to extract a PNG at a specific timestamp.
9. Use Webcam to capture an image from the camera.
10. Use Batch Process to select multiple images, apply a filter, preview thumbnails, and download a ZIP.
11. Use Download to save the final live-preview image.

## API endpoints

### Process one image

```text
POST /api/process
```

Multipart fields:
- `image`: image file
- `operation`: filter name

Supported operations:
- `original`
- `grayscale`
- `blur`
- `sharpen`
- `denoise`
- `edges`
- `sepia`
- `warm`
- `cool`
- `vintage`

### Extract a video frame

```text
POST /api/extract-frame
```

Multipart fields:
- `video`: video file
- `timestamp`: frame timestamp in seconds

### Process a batch

```text
POST /api/batch-process
```

Multipart fields:
- `images`: one or more image files
- `operation`: filter name

The response is a ZIP archive containing processed PNG images.

## How processing works

- OpenCV and NumPy process server-side filters and video frames.
- Live browser adjustments use the HTML canvas and client-side pixel processing.
- Resize, crop, and rotation are rendered in the browser.
- Uploaded and processed files are kept in memory or temporary storage and are not saved to a database.
- Webcam capture requires browser permission.

## Notes

This project is intended for educational and local use. Uploading sensitive content to a public deployment should be avoided unless appropriate security, privacy, and file-validation controls are added.
