import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class GmailEmailService:
    def __init__(self):
        self.server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.port = int(os.getenv("SMTP_PORT", 587))
        self.username = os.getenv("SMTP_USERNAME")
        self.password = os.getenv("SMTP_PASSWORD")
        self.sender = os.getenv("EMAILS_FROM")

    async def send_2fa_otp(self, email: str, otp: str):
        """
        Sends a real 2FA OTP email using the configured SMTP server.
        """
        if not self.username or not self.password:
            print("[EMAIL_ERROR] SMTP credentials not configured. Falling back to console.")
            print(f">>> 2FA OTP for {email}: {otp} <<<")
            return

        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = "[URGENT] Regent AI Security Verification"
            message["From"] = f"Regent AI Security <{self.sender}>"
            message["To"] = email

            # HTML Content for a premium look
            html = f"""
            <html>
              <body style="background-color: #050505; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px;">
                <div style="max-width: 600px; margin: auto; border: 1px solid #1a1a1a; padding: 30px; border-radius: 15px; background-color: #0a0a0a;">
                  <h1 style="color: #00FF41; text-align: center; letter-spacing: 5px;">REGENT AI</h1>
                  <p style="color: #888; text-align: center; font-size: 12px; letter-spacing: 2px;">NEURAL PERFORMANCE ARCHITECTURE</p>
                  
                  <div style="margin: 40px 0; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 40px 0; text-align: center;">
                    <p style="font-size: 14px; color: #ddd; margin-bottom: 25px;">Your secure access code is ready for initialization:</p>
                    <div style="background-color: #111; padding: 20px; border-radius: 10px; border: 1px solid #222; display: inline-block;">
                      <span style="font-size: 42px; font-weight: bold; color: #00FF41; letter-spacing: 10px;">{otp}</span>
                    </div>
                    <p style="font-size: 10px; color: #444; margin-top: 25px;">TIMESTAMP: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
                  </div>
                  
                  <p style="font-size: 11px; color: #444; text-align: center;">
                    This code will expire in 10 minutes. If you did not request this session, please contact your commanding coach or reset your security credentials.
                  </p>
                </div>
                <p style="text-align: center; color: #222; font-size: 8px; margin-top: 20px;">SYSTEM_VERSION_2.0 // ENCRYPTION_LEVEL_AES256</p>
              </body>
            </html>
            """
            
            part = MIMEText(html, "html")
            message.attach(part)

            # Send email
            with smtplib.SMTP(self.server, self.port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.sendmail(self.sender, email, message.as_string())

            print(f"[SUCCESS] Security code dispatched to {email}")

        except Exception as e:
            print(f"[EMAIL_CRITICAL_FAILURE] Could not dispatch OTP: {e}")
            # Fallback for developer
            print(f">>> FALLBACK 2FA OTP for {email}: {otp} <<<")

    async def send_analysis_notification(self, email: str, player_name: str, metrics: dict):
        """
        Notifies a player that their performance stats have been updated via AI analysis.
        """
        if not self.username or not self.password:
            print(f"[NOTIF_FALLBACK] Analysis notification for {email}: {metrics}")
            return

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = "NEW_NEURAL_TELEMETRY: Your Stats Have Been Updated"
            message["From"] = f"Regent AI Performance <{self.sender}>"
            message["To"] = email

            speed = metrics.get("ball_speed_kph", metrics.get("top_speed_kph", "N/A"))
            angle = metrics.get("elbow_extension_angle", "N/A")

            html = f"""
            <html>
              <body style="background-color: #050505; color: #ffffff; font-family: 'Segoe UI', sans-serif; padding: 40px;">
                <div style="max-width: 600px; margin: auto; border: 1px solid #1a1a1a; padding: 30px; border-radius: 15px; background-color: #0a0a0a;">
                  <h1 style="color: #00FF41; text-align: center; letter-spacing: 5px;">TACTICAL FEEDBACK</h1>
                  <p style="color: #888; text-align: center; font-size: 10px; letter-spacing: 2px;">PERFORMANCE SYNCHRONIZATION COMPLETE</p>
                  
                  <div style="margin: 30px 0; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 20px 0;">
                    <p style="font-size: 14px;">Greetings Operative <strong>{player_name}</strong>,</p>
                    <p style="font-size: 13px; color: #aaa;">A new AI Analysis session has been finalized by your coach. Your profile has been updated with the following telemetry:</p>
                    
                    <div style="background-color: #111; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #00FF41;">
                      <p style="margin: 5px 0;"><strong>VELOCITY:</strong> <span style="color: #00FF41;">{speed} KPH</span></p>
                      <p style="margin: 5px 0;"><strong>ELBOW_ANGLE:</strong> <span style="color: #00FF41;">{angle}°</span></p>
                    </div>
                    
                    <p style="font-size: 13px; color: #aaa;">Log in to the <strong>Player Dashboard</strong> to view the full neural overlay and coaching insights.</p>
                  </div>
                  
                  <p style="font-size: 10px; color: #444; text-align: center;">TIMESTAMP: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
                </div>
              </body>
            </html>
            """
            
            part = MIMEText(html, "html")
            message.attach(part)

            with smtplib.SMTP(self.server, self.port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.sendmail(self.sender, email, message.as_string())

            print(f"[SUCCESS] Analysis notification dispatched to {email}")

        except Exception as e:
            print(f"[NOTIF_CRITICAL_FAILURE] {e}")

EmailService = GmailEmailService()
