from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from app.models.user import UserCreate, UserResponse
from app.utils.security import Security, SECRET_KEY, ALGORITHM
from app.core.repository import UserRepository
from datetime import datetime, timezone
from jose import JWTError, jwt
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/google")
async def google_login(id_token_str: str, request: Request):
    """
    Verifies a Google ID Token and logs in/registers the user.
    """
    try:
        # Validate against all possible client ID configurations
        CLIENT_IDS = [
            os.getenv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"),
            os.getenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
            os.getenv("GOOGLE_CLIENT_ID") # Standard backend naming
        ]
        # Filter out None values
        CLIENT_IDS = [cid for cid in CLIENT_IDS if cid]
        
        id_info = id_token.verify_oauth2_token(
            id_token_str, 
            google_requests.Request()
        )
        
        # Security: Verify that the aud (audience) matches one of our client IDs
        if id_info['aud'] not in CLIENT_IDS:
            raise ValueError('Wrong recipient.')

        email = id_info['email']
        full_name = id_info.get('name', 'Regent Operative')
        
        # Check if user exists
        user = await UserRepository.get_user_by_email(email)
        
        if not user:
            # Automatic Registration for new Google users (Defaults to Player)
            user_dict = {
                "email": email,
                "full_name": full_name,
                "role": "player",
                "hashed_password": Security.hash_password(os.urandom(24).hex()),
                "created_at": datetime.now(timezone.utc),
                "last_ip": request.client.host,
                "primary_skill": "batsman",
                "batting_hand": "right",
                "points": 0,
                "level": 1
            }
            user_id = await UserRepository.create_user(user_dict)
            user = await UserRepository.get_user_by_id(user_id)
            
            # Log new registration
            from app.core.repository import SecurityRepository
            await SecurityRepository.log_audit({
                "user_id": str(user_id),
                "action": "google_register",
                "status": "success",
                "ip_address": request.client.host
            })
        
        # Generate final Access Token
        access_token = Security.create_access_token(
            data={"sub": str(user["_id"]), "email": user["email"]}
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user["_id"]),
                "full_name": user["full_name"],
                "role": user["role"]
            }
        }
        
    except Exception as e:
        print(f"[GOOGLE_AUTH_ERROR] {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Neural Link Verification Failed (Invalid Google Token)"
        )

@router.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate, request: Request):
    # 1. Check existence
    existing_user = await UserRepository.get_user_by_email(user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists."
        )

    # 2. Process data based on Role
    user_dict = user.model_dump()
    password = user_dict.pop("password")
    
    # Initialize dynamic defaults based on role
    if user.role == "coach":
        user_dict.update({
            "primary_skill": "coaching",
            "experience_years": 0,
            "achievements": []
        })
    else: # player
        user_dict.update({
            "primary_skill": "batsman", # Default
            "batting_hand": "right",
            "points": 0,
            "level": 1
        })

    # 3. Security & Metadata
    user_dict["hashed_password"] = Security.hash_password(password)
    user_dict["created_at"] = datetime.now(timezone.utc)
    user_dict["last_ip"] = request.client.host
    
    # 4. Save
    user_id = await UserRepository.create_user(user_dict)
    user_dict["_id"] = user_id 
    
    return user_dict

@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    # 1. Find user
    user = await UserRepository.get_user_by_email(form_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # 2. Verify password
    if not Security.verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # 3. Check for 2FA in Unified Settings
    from app.core.repository import SettingsRepository, SecurityRepository
    settings = await SettingsRepository.get_preferences(str(user["_id"]))
    security = await SecurityRepository.get_security_settings(str(user["_id"]))
    
    # Check if 2FA is enabled in either (default to True for security if not found)
    is_2fa_enabled = True
    if settings and "two_factor_enabled" in settings:
        is_2fa_enabled = settings["two_factor_enabled"]
    elif security and "two_factor_enabled" in security:
        is_2fa_enabled = security["two_factor_enabled"]

    if is_2fa_enabled:
        # Generate a secure 6-digit OTP
        import random
        otp_code = str(random.randint(100000, 999999))
        
        # Save to DB
        await SecurityRepository.set_otp(str(user["_id"]), otp_code)
        
        # Send via Email Service (Mocked for dev)
        from app.core.email import EmailService
        await EmailService.send_2fa_otp(user["email"], otp_code)

        # Log the attempt as pending
        await SecurityRepository.log_audit({
            "user_id": str(user["_id"]),
            "action": "login_2fa_pending",
            "status": "pending",
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent", "Unknown")
        })
        
        from datetime import timedelta
        # Return a trigger for the frontend to show 2FA screen
        return {
            "two_factor_required": True,
            "user_id": str(user["_id"]),
            "email": user["email"],
            "temp_token": Security.create_access_token(
                data={"sub": str(user["_id"]), "type": "2fa_pending"},
                expires_delta=timedelta(minutes=10)
            )
        }

    # 4. Update login metadata in DB (Silent update)
    await UserRepository.update_login_metadata(
        str(user["_id"]), 
        request.client.host
    )

    # 5. Generate JWT Token
    access_token = Security.create_access_token(
        data={"sub": str(user["_id"]), "email": user["email"]}
    )

    # Log success
    from app.core.repository import SecurityRepository
    await SecurityRepository.log_audit({
        "user_id": str(user["_id"]),
        "action": "login_success",
        "status": "success",
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent", "Unknown")
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }

@router.post("/verify-2fa")
async def verify_2fa(user_id: str, code: str, request: Request):
    """Verifies the 2FA code and issues the final JWT."""
    from app.core.repository import SecurityRepository
    
    verified = await SecurityRepository.verify_otp(user_id, code)
    if not verified:
        await SecurityRepository.log_audit({
            "user_id": user_id,
            "action": "2fa_failed",
            "status": "failed",
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent", "Unknown")
        })
        raise HTTPException(status_code=401, detail="Invalid verification code")

    # Get user
    user = await UserRepository.get_user_by_id(user_id)
    
    # Update login metadata
    await UserRepository.update_login_metadata(user_id, request.client.host)

    # Generate final JWT
    access_token = Security.create_access_token(
        data={"sub": user_id, "email": user["email"]}
    )

    # Log success
    await SecurityRepository.log_audit({
        "user_id": user_id,
        "action": "2fa_success",
        "status": "success",
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent", "Unknown")
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            print("AUTH_DEBUG: sub (user_id) missing in payload")
            raise credentials_exception
    except JWTError as e:
        print(f"AUTH_DEBUG: JWT decode failed: {e}")
        raise credentials_exception

    # Fetch user from database
    user = await UserRepository.get_user_by_id(user_id)
    if user is None:
        print(f"AUTH_DEBUG: User not found in DB for ID: {user_id}")
        raise credentials_exception
        
    return user
