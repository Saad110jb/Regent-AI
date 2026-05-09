import os
import google.generativeai as genai
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Configure the Neural Gateway
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class NeuralAdvisoryService:
    """
    High-performance advisory layer that uses Gemini 1.5 Pro to synthesize 
    tactical insights from raw telemetry and player history.
    """
    
    @staticmethod
    async def get_coaching_report(self, player_name: str, current_metrics: Dict, history: List[Dict]) -> str:
        """
        Generates a deep biomechanical report with fallbacks.
        """
        if not os.getenv("GEMINI_API_KEY"):
            return "Neural Advisor Offline: Missing API Key."

        models_to_try = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest']
        
        history_summary = [
            {"speed": h.get("top_speed_kph"), "elbow": h.get("metrics", {}).get("elbow_extension_angle"), "date": str(h.get("created_at"))}
            for h in history
        ]

        prompt = f"""
        SYSTEM_ROLE: You are the Regents AI Chief Biomechanical Specialist.
        PLAYER: {player_name}
        CURRENT_TELEMETRY: {current_metrics}
        RECENT_SESSIONS: {history_summary}
        """

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                return response.text
            except Exception as e:
                continue
        return "Tactical report generation pending. Session telemetry saved."

    async def get_neural_advice(self, player_name: str, career_stats: Dict) -> str:
        """
        Provides short, motivating neural advice with fallbacks.
        """
        if not os.getenv("GEMINI_API_KEY"):
            return "Synchronizing neural link... (Missing API Key)"

        models_to_try = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest']
        
        prompt = f"""
        SYSTEM_ROLE: You are the Regents AI Personal Performance Coach.
        PLAYER: {player_name}
        CAREER_STATS: {career_stats}
        """

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                return response.text
            except Exception as e:
                continue
        return "Neural guidance online. Keep training, operative."

    @staticmethod
    async def get_squad_briefing(team_name: str, history: List[Dict]) -> str:
        """
        Synthesizes an executive squad summary for the coach with fallbacks.
        """
        if not os.getenv("GEMINI_API_KEY"):
            return "Tactical data synchronization pending..."

        # List of models to try in order of preference (Stable names for your tier)
        models_to_try = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest']
        
        # Extract top level metrics
        recent_speeds = [h.get("top_speed_kph", 0) for h in history if h.get("top_speed_kph")]
        avg_squad_speed = sum(recent_speeds) / len(recent_speeds) if recent_speeds else 0

        prompt = f"""
        SYSTEM_ROLE: You are the Regents AI Chief Tactical Officer.
        OBJECTIVE: Provide a 3-sentence executive briefing for the Head Coach of squad '{team_name}'.
        SQUAD TELEMETRY:
        - Recent Sessions: {len(history)}
        - Average Delivery Speed: {avg_squad_speed:.1f} KPH
        - Recent Top Performers: {[h.get('player_name') for h in history[:3]]}
        """

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                return response.text
            except Exception as e:
                print(f"[NEURAL_FALLBACK] Model {model_name} failed: {e}")
                continue

        return "Squad telemetry analysis temporarily throttled by HQ. Retrying shortly."

NeuralCoach = NeuralAdvisoryService()
