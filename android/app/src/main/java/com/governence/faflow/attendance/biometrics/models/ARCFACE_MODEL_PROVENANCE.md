# InsightFace ArcFace / MobileFaceNet Model Provenance

## 1. Overview & Architecture
- **Model Name**: InsightFace MobileFaceNet / ArcFace Feature Extractor
- **File Name**: `arcface_mobilefacenet.onnx` (Asset path: `app/src/main/assets/models/arcface_mobilefacenet.onnx`)
- **Upstream Source**: DeepInsight InsightFace Official Model Zoo (`https://github.com/deepinsight/insightface/tree/master/recognition/arcface_torch`)
- **Backbone**: MobileFaceNet / ResNet-50 with ArcFace (Additive Angular Margin Loss)
- **Task**: Deep Facial Feature Representation & Embedding Extraction

## 2. Input / Output Tensor Specifications
- **Input Tensor**:
  - Name: `data` / `input.1`
  - Shape: `[1, 3, 112, 112]` Float32 (NCHW layout)
  - Color Format: RGB
  - Resolution: Canonical $112 \times 112$ pixels (aligned via 5-point Umeyama similarity transform)
  - Normalization:
    $$\text{Pixel}_{\text{norm}} = \frac{\text{Pixel} - 127.5}{128.0}$$
- **Output Tensor**:
  - Name: `output` / `fc1` / `features`
  - Shape: `[1, 512]` Float32
  - Content: 512-dimensional facial feature vector
  - Postprocessing: $L_2$ Normalization:
    $$E_{\text{norm}} = \frac{E}{\max(\|E\|_2, 10^{-12})}$$

## 3. Canonical 5-Point Alignment Template ($112 \times 112$)
Standard InsightFace/ArcFace canonical reference points:
1. Left Eye: $(38.2946, 51.6963)$
2. Right Eye: $(73.5318, 51.5014)$
3. Nose Tip: $(56.0252, 71.7366)$
4. Left Mouth Corner: $(41.5493, 92.3655)$
5. Right Mouth Corner: $(70.7299, 92.2041)$

## 4. Licensing & Distribution Notice
- **Source Code License**: MIT License (InsightFace repository code).
- **Pretrained Model Weights License**: **Non-Commercial Academic Research & Evaluation Only** (DeepInsight / InsightFace terms).
- **Redistribution Policy**: Pretrained weights are restricted from direct uncertified commercial redistribution. Production commercial deployments must obtain appropriate institutional licensing or train proprietary backbone weights.
