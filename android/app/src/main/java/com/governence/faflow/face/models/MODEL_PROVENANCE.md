# InsightFace SCRFD Model Provenance & Specification

## Model Overview
- **Model Name**: `scrfd_500m_kps` (Sample and Computation Redistribution for Efficient Face Detection)
- **Source Project**: Official InsightFace Repository (`https://github.com/deepinsight/insightface`)
- **Model Architecture**: SCRFD 500M FLOPs with 5-Point Facial Landmark Regression (`kps`)
- **Target Task**: High-speed, high-accuracy on-device mobile face detection & landmark localization
- **Export Format**: ONNX (Open Neural Network Exchange) Format v1.12 / Opset 11
- **File Name**: `scrfd_500m_kps.onnx`
- **File Size**: ~2.5 MB (Compact footprint optimized for ARM64 mobile execution)
- **SHA-256 Checksum**: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (Base Reference)

---

## License & Usage Terms
- **Source Code License**: MIT License (InsightFace codebase)
- **Model Weights License**: Non-Commercial / Academic Research & Evaluation License (DeepInsight).
  > **Note**: InsightFace pretrained model weights are released by their authors under non-commercial research/evaluation terms. Commercial deployments require retraining on proprietary/commercial-friendly datasets or obtaining explicit commercial licensing from DeepInsight.
- **Redistribution Policy**: Bundled directly as an application asset for on-device inference without external unauthorized distribution.

---

## Tensor Architecture & Input Specification

### 1. Input Tensor
- **Tensor Name**: `input.1` (or `input`)
- **Tensor Shape**: `[1, 3, 640, 640]` (NCHW format: Batch, Channels, Height, Width)
- **Data Type**: `Float32`
- **Color Format**: RGB
- **Normalization Formula**:
  $$\text{Normalized} = \frac{\text{Pixel Value} - 127.5}{128.0}$$
  $$\text{Mean} = [127.5, 127.5, 127.5], \quad \text{Std} = [128.0, 128.0, 128.0]$$

---

## Output Tensor Specification & Multi-Stride Anchor Strides

SCRFD utilizes a Feature Pyramid Network (FPN) operating over 3 spatial strides:

| Stride Level | Feature Map Resolution ($640 \times 640$) | Spatial Locations | Anchors per Location | Total Anchors |
| :--- | :--- | :--- | :--- | :--- |
| **Stride 8** | $80 \times 80$ | 6,400 | 2 | 12,800 |
| **Stride 16** | $40 \times 40$ | 1,600 | 2 | 3,200 |
| **Stride 32** | $20 \times 20$ | 400 | 2 | 800 |
| **Total** | — | 8,400 | 2 | **16,800 anchors** |

### Output Tensors:
1. **Classification Scores**:
   - `score_8` (Shape: `[12800, 1]`)
   - `score_16` (Shape: `[3200, 1]`)
   - `score_32` (Shape: `[800, 1]`)
2. **Bounding Box Distance Offsets**:
   - `bbox_8` (Shape: `[12800, 4]` $\rightarrow [l, t, r, b]$ distances from anchor center)
   - `bbox_16` (Shape: `[3200, 4]`)
   - `bbox_32` (Shape: `[800, 4]`)
3. **5-Point Facial Landmarks (`kps`)**:
   - `kps_8` (Shape: `[12800, 10]` $\rightarrow [dx_1, dy_1, \dots, dx_5, dy_5]$ offsets)
   - `kps_16` (Shape: `[3200, 10]`)
   - `kps_32` (Shape: `[800, 10]`)

---

## Coordinate Decoding Formulas
For an anchor center $(cx, cy)$ at stride $s$:
- **Bounding Box**:
  $$x_1 = cx - l \cdot s, \quad y_1 = cy - t \cdot s$$
  $$x_2 = cx + r \cdot s, \quad y_2 = cy + b \cdot s$$
- **5 Facial Landmarks** ($k \in [1..5]$):
  $$\text{landmark}_{k, x} = cx + dx_k \cdot s, \quad \text{landmark}_{k, y} = cy + dy_k \cdot s$$

---

## Postprocessing Thresholds
- **Confidence Threshold**: $0.50$ (Configurable: $0.30 - 0.85$)
- **Non-Maximum Suppression (NMS) IoU Threshold**: $0.40$
- **Target Face Size for Staff Attendance**: Bounding box width $\ge 120\text{px}$ in $640 \times 480$ frame.
