# Regents AI: Elite Cricket Analysis Engine

**Regents AI** is a state-of-the-art, AI-driven cricket performance platform designed to transform raw match footage into high-fidelity biometric data and tactical insights. By utilizing a modular "Multi-Expert" neural architecture, the system provides professional-grade analytics for players and coaches alike.

---

## 🎯 What is Regents AI Doing? (Project Mission)

Regents AI bridges the gap between high-level computer vision and on-field coaching. The application acts as a **Digital Performance Director**, automating the complex task of video analysis that was previously reserved for elite international squads. 

The app processes raw video streams through a series of "Neural Experts" to extract kinetics, identify techniques, and track ball trajectories. This data is then synthesized into a futuristic, "Glassmorphism" interface, giving coaches the power to make data-driven decisions in real-time, manage their squad's recruitment, and monitor every player's "Ballistic" development.

---

## ✨ Core Features & Functionality

### 1. 🤖 AI Analysis Engine
The heart of the application. It allows coaches to upload or record footage which is then processed by our neural pipeline.
*   **Neural Processing:** Automatically segments video into bowling and batting events.
*   **Keypoint Extraction:** Maps the skeletal structure of the athlete to identify technical flaws in real-time.
*   **Kinetic Calculation:** Calculates the exit velocity of the ball and the release speed of the bowler using Euclidean distance mapping.

### 2. 📊 Coach Dashboard (The Command Center)
A high-fidelity overview of the entire squad's health and performance.
*   **New AI Session:** Quick access to initiate neural analysis on new footage.
*   **Top Performers:** A live leaderboard ranking the "Operatives" by their recent performance metrics.
*   **Squad Overview:** A summary of win/loss records and overall team "Neural Health."

### 3. 👥 Squad Management & Recruitment
A sophisticated, invite-only system for building elite cricket teams.
*   **Initialize Squad:** Coaches can define their team's identity, location, and tactical focus.
*   **Recruitment Matrix:** A live tracking system for pending invitations. Coaches can invite players by ID and revoke invitations instantly if recruitment targets shift.
*   **Leadership Assignment:** Designated roles for **Captains** and **Vice-Captains** to manage on-field communication.

### 4. 🛠️ Operative Modification (Advanced Player Profiles)
Detailed technical profiles for every player in the squad.
*   **Batting Matrix:** Tracking runs, strike rates, and technical shot breakdown.
*   **Ballistic Metrics:** Monitoring "MAX KPH" (release speed) and delivery consistency.
*   **Encrypted Data:** Every operative's performance history is securely logged for long-term development tracking.

### 5. 💬 Squad Comms (Encrypted Neural Channel)
A dedicated, high-security communication terminal for team tactical discussions.
*   **Encrypted Messaging:** Secure channel for coaches to share technical feedback and "Tactical Documents" (PDFs).
*   **Coach Access Badge:** Verified badges for team leadership to maintain command authority.

### 6. 🧠 Neural Briefings
AI-generated reports that synthesize days of training into actionable summaries.
*   **Tactical Insights:** The AI analyzes squad-wide trends and alerts the coach to declining performance or potential injury risks based on kinetic data.

---

## 🧠 The Neural Pipeline: Four Experts Architecture

Our analysis engine is powered by four specialized **YOLO11** models:

### 1. 🦴 Skeleton Expert (Pose Estimation)
*   **Role:** Biometric breakdown of bowling actions and batting stances.
*   **Capability:** Tracks human keypoints to analyze arm angles, weight distribution, and explosive movement patterns.

### 2. 🏟️ Bowler Expert (Environment Detection)
*   **Role:** Spatial awareness and role identification.
*   **Capability:** Near-perfect detection (**99.4% mAP50**) of the pitch, bowler, batsman, and umpire.

### 3. 🏏 Batting Expert (Shot Classification)
*   **Role:** Technical shot identification.
*   **Capability:** Classifies cricket shots (Drives, Cuts, Pulls) with high Top-5 accuracy (**86.6%**).

### 4. 🎾 Ball Tracking Expert (Kinetic Detection)
*   **Role:** Ball velocity and trajectory analysis.
*   **Capability:** High-speed ball detection (**90.1% mAP50**) enabling real-time speed calculation.

---

## 🚀 Technical Stack

*   **Vision Engine:** YOLO11 (Pose, Detect, and Classify)
*   **Backend:** FastAPI (Python)
*   **Mobile Framework:** React Native (Expo)
*   **Data Lake:** MongoDB (Neural sessions and squad telemetry)

---

## 📂 Project Structure

```bash
├── ai_engine/       # YOLO11 Expert training scripts and model weights
├── backend/         # FastAPI recruitment and telemetry API
└── mobile_app/      # React Native futuristic coach terminal
```

---

## 📜 Technical Reports
For a deeper dive into model training metrics, see:
*   [AI Model Performance Report](file:///C:/Users/hp/.gemini/antigravity/brain/fe6f48e6-3d49-49b7-b9d0-84d088edf199/ai_model_report.md)

---

© 2026 THE REGENTS | ADVANCED NEURAL RECRUITMENT
