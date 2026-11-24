# PixelLab - Image Enhancement and Processing Studio

A beginner-friendly image editor built with Python, Flask, OpenCV, NumPy, HTML, CSS and JavaScript.

## Features
- Live brightness and contrast sliders (updates immediately in the browser)
- Side navigation with separate Adjust and Filters tabs
- Grayscale, blur, sharpen, noise reduction and edge detection filters
- Original and processed preview on a canvas
- Download the edited result as PNG
- Drag-and-drop upload
- PNG, JPG, JPEG, WEBP and BMP support
- 10 MB upload limit

## Folder structure
```text
image-enhancement-processing-studio/
├── app.py
├── requirements.txt
├── README.md
└── static/
    ├── index.html
    ├── style.css
    └── app.js
```

## Requirements
- Python 3.10 or newer (64-bit recommended)
- VS Code (recommended)
- Modern web browser

## Setup on Windows
1. Extract the ZIP and open the project folder in VS Code.
2. Open Terminal > New Terminal.
3. Create a virtual environment:
```powershell
py -m venv venv
```
4. Activate it in PowerShell:
```powershell
.\venv\Scripts\Activate.ps1
```
If PowerShell blocks activation, use Command Prompt:
```cmd
venv\Scripts\activate.bat
```
5. Install dependencies:
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```
6. Start the server:
```bash
python app.py
```
7. Open http://127.0.0.1:5000 in your browser.

Do not open `static/index.html` directly. Use the Flask address so the filter API works.

## How to use
1. Upload an image using Upload image or drag and drop.
2. Select the Adjust tab in the left sidebar.
3. Move Brightness and Contrast sliders. The preview updates immediately without a server request for each slider movement.
4. Select Filters in the sidebar to apply grayscale, blur, sharpen, noise reduction or edge detection.
5. Return to Adjust to continue changing brightness and contrast.
6. Click Download to save the final result.

## How it works
- Flask receives uploaded images for OpenCV filter operations at `POST /api/process`.
- OpenCV applies the selected filter and returns a PNG.
- Brightness and contrast are rendered live in the browser using the HTML canvas `filter` property.
- The final canvas output is downloaded as a PNG.

## API
`POST /api/process` multipart fields:
- `image`: uploaded image file
- `operation`: `grayscale`, `blur`, `sharpen`, `denoise` or `edges`

## Notes and limitations
This is an educational image-processing project. Brightness and contrast are adjusted in the browser for immediate feedback; filters are processed by the Python/OpenCV backend. The original uploaded file is not modified. Images are processed in memory and are not saved to a database. Avoid uploading sensitive images to an untrusted deployment.

## Future scope
- Crop, rotate and resize tools
- Before/after comparison slider
- Undo and redo history
- Video frame processing
- Batch image processing
