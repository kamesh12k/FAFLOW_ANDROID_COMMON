# On-Device Anti-Spoofing / Presentation Attack Detection Model Provenance

## 1. Overview & Architectural Role
- **Component**: On-Device Presentation Attack Detection (PAD) / Silent Anti-Spoofing
- **Target ONNX File**: `models/antispoof_minifasnet.onnx` (Asset path: `app/src/main/assets/models/antispoof_minifasnet.onnx`)
- **Reference Architecture**: MiniFASNet / Silent-Face-Anti-Spoofing (`https://github.com/minivision-ai/Silent-Face-Anti-Spoofing`)
- **Input Specifications**:
  - Shape: `[1, 3, 80, 80]` or `[1, 3, 128, 128]` Float32 (NCHW layout)
  - Color Format: BGR / RGB
  - Normalization: $(x - 127.5) / 128.0$
- **Output Specifications**:
  - Shape: `[1, 3]` Float32 (Softmax class probabilities for: Real Face, 2D Photo Attack, Screen / Replay Attack)

## 2. Licensing & Model Weight Status
- **Repository Source**: Open-source anti-spoofing research frameworks (e.g. MiniVision Silent-Face-Anti-Spoofing).
- **Redistribution Restrictions**: Pretrained model weights are restricted under non-commercial research licenses.
- **Model Provisioning Status**:
  > **Note**: Dedicated ONNX anti-spoof model weights are not bundled into the binary build until formal institutional licensing is verified. The application provides an open, pluggable abstraction (`AntiSpoofModel` & `AntiSpoofModelManager`) backed by a multi-layer passive motion and active challenge-response liveness defense.

## 3. Defense Layering
1. **Layer 1**: Temporal Face Tracking Consistency & Continuity
2. **Layer 2**: Natural Micro-Movement & Photostatic Jitter Analysis
3. **Layer 3**: 3D Head Pose Variations (Yaw, Pitch, Roll from landmark geometry)
4. **Layer 4**: Randomized Active Challenge-Response (`TURN_LEFT`, `TURN_RIGHT`, `LOOK_UP`, `LOOK_DOWN`, `BLINK`)
5. **Layer 5**: Pluggable ONNX Deep Presentation Attack Classifier
