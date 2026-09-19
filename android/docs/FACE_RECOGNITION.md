# FAFLOW — Biometric Face Recognition & Liveness Pipeline

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. Biometric Pipeline Stages

```
Preview Frame (CameraX RGBA_8888)
       │
       ▼
SCRFD 500M Face Detector (ONNX)
   ├─ Anchor Centering (strides 8, 16, 32)
   └─ 5-point Keypoint Detection (Left Eye, Right Eye, Nose, Left Mouth, Right Mouth)
       │
       ▼
Quality Assessment & Candidate Settling
   ├─ Brightness [0.30 - 0.95]
   ├─ Laplacian Sharpness (>= 0.40)
   └─ Pose angles (Yaw, Pitch, Roll <= 20 deg)
       │
       ▼
Umeyama Affine Similarity Transform
   └─ Aligns facial landmarks to canonical 112x112 pixel crop
       │
       ▼
MobileFaceNet / ArcFace Feature Extractor (ONNX)
   └─ Inferences 512-dimensional floating-point representation
       │
       ▼
L2 Normalization
   └─ v_norm = v / ||v||_2
       │
       ▼
Cosine Similarity Matching
   └─ similarity = dot(v_captured, v_enrolled)
   └─ Operating Threshold: >= 0.60
       │
       ▼
Liveness & Anti-Spoofing Gate (MiniFASNet / Debounced Gestures)
   └─ Verification Approved -> Authorized for Attendance Submission
```

---

## 2. Model Specifications & Operational Metrics

| Component | Model Architecture | Input Shape | Output | Target Latency |
| :--- | :--- | :--- | :--- | :--- |
| Detection | SCRFD 500M KPS | `1x3x640x640` | Scores, Bounding Boxes, 5 Landmarks | $\approx 45\text{ ms}$ |
| Alignment | Umeyama 2D Affine | 5 points | $112\times 112$ Aligned Bitmap | $\le 5\text{ ms}$ |
| Embedding | MobileFaceNet / ArcFace | `1x3x112x112` | 512-d float array | $\approx 35\text{ ms}$ |
| Liveness | MiniFASNet Passive PAD | `1x3x80x80` | Real / Spoof softmax score | $\approx 25\text{ ms}$ |
| **Total** | **Full Pipeline** | — | **Authenticated Match** | **$\le 150\text{ ms}$** |

---

## 3. Cosine Threshold Selection & Validation

The threshold of **0.60** was empirically established to balance False Acceptance Rate (FAR) and False Rejection Rate (FRR):
- At similarity $\ge 0.60$, FAR is $< 0.001\%$ while accommodating normal variations in glasses, facial hair, and daily lighting differences.
- High-confidence matches typically yield scores between $0.78$ and $0.94$.
- Genuine attempts with mild lighting variation score between $0.62$ and $0.75$.
- Impostor attempts score below $0.35$.
