# InsightFace SCRFD Model Provisioning Guide

## Required Model Asset
- **File Name**: `scrfd_500m_kps.onnx`
- **Location**: `app/src/main/assets/models/scrfd_500m_kps.onnx`
- **Upstream Source**: InsightFace Official Repository (`https://github.com/deepinsight/insightface/tree/master/detection/scrfd`)
- **Variant**: SCRFD 500M FLOPs with 5-point Keypoints (`kps`)
- **Expected Input Resolution**: `[1, 3, 640, 640]` Float32 (NCHW)
- **Expected Strides**: 8, 16, 32 (2 anchors per spatial location)

## Manual Provisioning Instructions
1. Download or export `scrfd_500m_kps.onnx` from the official InsightFace model zoo.
2. Verify that input tensor name is `input.1` (or `input`) with shape `1x3x640x640`.
3. Verify output tensor names for scores (`score_8`, `score_16`, `score_32`), bounding boxes (`bbox_8`, `bbox_16`, `bbox_32`), and landmarks (`kps_8`, `kps_16`, `kps_32`).
4. Place the `.onnx` file directly in this directory:
   `app/src/main/assets/models/scrfd_500m_kps.onnx`

## Checksum Verification
- Calculate SHA-256 using:
  ```powershell
  Get-FileHash app\src\main\assets\models\scrfd_500m_kps.onnx -Algorithm SHA256
  ```
- Record the hash in `face/models/MODEL_PROVENANCE.md`.
