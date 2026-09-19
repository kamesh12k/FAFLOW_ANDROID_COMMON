# FAFLOW — Intellectual Property & Commercial Licensing

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. Proprietary Software Notice

All source code, designs, architectures, and documentation contained in the FAFLOW platform (including the Android mobile application, FastAPI backend services, PostgreSQL database schema definitions, and React web administrative dashboard) are the exclusive intellectual property of:

**GOVERNENCE**  
Developer: **KAMESHGOVINDHAN**

All rights reserved. Unauthorized copying, distribution, decompilation, or commercial redistribution without prior written consent from GOVERNENCE is strictly prohibited.

---

## 2. Third-Party Dependencies & Model Licensing

FAFLOW incorporates select open-source libraries and machine-learning assets under their respective licenses:

| Component / Library | Source / Author | License Type | Commercial Compatibility |
| :--- | :--- | :--- | :--- |
| **MobileFaceNet** | InsightFace / DeepInsight | Apache License 2.0 | Full Commercial Use Permitted |
| **SCRFD (Detection)** | InsightFace / DeepInsight | Non-Commercial / Research (Default) | Commercial license required for enterprise deployment, OR replace with open Apache 2.0 / MIT face detector (e.g., BlazeFace / YuNet). |
| **ONNX Runtime** | Microsoft Corporation | MIT License | Full Commercial Use Permitted |
| **FastAPI** | Sebastián Ramírez | MIT License | Full Commercial Use Permitted |
| **SQLAlchemy** | Michael Bayer | MIT License | Full Commercial Use Permitted |
| **PostgreSQL** | PostgreSQL Global Development Group | PostgreSQL License | Full Commercial Use Permitted |
| **React & Vite** | Meta Platforms, Inc. / Evan You | MIT License | Full Commercial Use Permitted |
| **Jetpack Compose** | Google LLC | Apache License 2.0 | Full Commercial Use Permitted |
| **CameraX** | Google LLC | Apache License 2.0 | Full Commercial Use Permitted |

---

## 3. Commercial Compliance Advisory: SCRFD

InsightFace models (such as SCRFD pretrained weights) are distributed under a non-commercial research license. For enterprise production deployments, GOVERNENCE has two verified options:
1. Obtain an enterprise commercial license from the InsightFace copyright holders.
2. Utilize the drop-in Apache 2.0 compatible detector alternatives (such as Google MediaPipe BlazeFace or OpenCV YuNet), which are directly supported by the FAFLOW `FaceDetector` abstraction.
