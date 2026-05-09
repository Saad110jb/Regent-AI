from fastapi import APIRouter, HTTPException, status, Depends,Query
from app.models.player import PlayerModel, CricketStats, UpdateCricketStats
from app.core.repository import PlayerRepository
from app.api.auth import get_current_user
from typing import List, Optional

router = APIRouter(prefix="/players", tags=["Players & Stats"])

# --- CREATE / INITIALIZE PROFILE ---
@router.post("/me", response_model=PlayerModel)
async def create_player_profile(
    player_data: PlayerModel, 
    current_user: dict = Depends(get_current_user)
):
    """
    Initializes a cricket identity. 
    A player can be independent (team_id=None) and join a team later.
    """
    user_id = str(current_user["_id"])
    
    # Check if a player profile already exists for this user
    existing_player = await PlayerRepository.get_player_by_user_id(user_id)
    if existing_player:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Player profile already exists for this user."
        )

    # Link the player profile to the authenticated User ID
    player_data.user_id = user_id
    
    success = await PlayerRepository.upsert_player_profile(player_data.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save player profile")
    
    return player_data
@router.get("/search")
async def search_players(query: str = Query(..., min_length=1)):
    """
    Searches for players by name or player_id using a regex pattern.
    """
    # Assuming your repository has a search method
    players = await PlayerRepository.search_players(query)
    return players
# --- READ PROFILE ---
@router.get("/me", response_model=PlayerModel)
async def get_my_player_stats(current_user: dict = Depends(get_current_user)):
    """
    Retrieves the authenticated user's own cricket performance data.
    """
    player = await PlayerRepository.get_player_by_user_id(str(current_user["_id"]))
    if not player:
        raise HTTPException(status_code=404, detail="Player profile not initialized")
    return player

@router.get("/me/neural-advice")
async def get_player_neural_advice(current_user: dict = Depends(get_current_user)):
    """
    Synthesizes personalized AI coaching advice for the player's dashboard.
    """
    player = await PlayerRepository.get_player_by_user_id(str(current_user["_id"]))
    if not player:
        raise HTTPException(status_code=404, detail="Player profile not found")
    
    from app.core.advisory import NeuralCoach
    advice = await NeuralCoach.get_player_neural_advice(
        player_name=current_user.get("full_name", "Operative"),
        player_stats=player.get("performance_stats", {})
    )
    return {"advice": advice}

from app.core.repository import TeamRepository

from fastapi import Request

async def verify_profile_access(user_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    current_id = str(current_user["_id"])
    
    # 1. Self Access (Players can see themselves)
    if current_id == user_id:
        # Restriction: Players cannot PATCH their own stats (they can see, but not change)
        if request.method == "PATCH" and "stats" in request.url.path:
            print(f"SECURITY_DENIED: Player {current_id} tried to update their own stats.")
            raise HTTPException(status_code=403, detail="Action Restricted: Only assigned Coaches can verify and update stats.")
        return current_user
        
    # 2. Coach Access (Coaches can see/edit players in their squad)
    if current_user.get("role") == "coach":
        player = await PlayerRepository.get_player_by_user_id(user_id)
        if player and player.get("team_id"):
            team = await TeamRepository.get_team_by_id(player["team_id"])
            if team and team.get("coach_id") == current_id:
                return current_user
    
    print(f"SECURITY_DENIED: User {current_id} (Role: {current_user.get('role')}) tried to access profile {user_id}")
    raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this profile.")

@router.get("/{user_id}")
async def get_any_player_stats(user_id: str, authorized_user: dict = Depends(verify_profile_access)):
    """
    Secured endpoint to view a player's stats by their User ID with leadership info.
    """
    player = await PlayerRepository.get_player_by_user_id(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player stats not found")
        
    # Check leadership status
    if player.get("team_id"):
        team = await TeamRepository.get_team_by_id(player["team_id"])
        if team:
            if team.get("captain_id") in [str(player.get("_id")), player.get("user_id")]:
                player["leadership_role"] = "CAPTAIN"
            elif team.get("vice_captain_id") in [str(player.get("_id")), player.get("user_id")]:
                player["leadership_role"] = "VICE CAPTAIN"
                
    return player

# --- UPDATE PROFILE & STATS ---
@router.patch("/me", response_model=PlayerModel)
async def update_my_profile(
    update_data: PlayerModel, 
    current_user: dict = Depends(get_current_user)
):
    """
    Updates general player info (batting style, specialty, etc.).
    """
    user_id = str(current_user["_id"])
    success = await PlayerRepository.upsert_player_profile(update_data.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    return update_data

@router.patch("/{user_id}/stats")
async def update_performance(
    user_id: str,
    new_stats: UpdateCricketStats, 
    authorized_user: dict = Depends(verify_profile_access)
):
    """
    Updates the performance_stats sub-document. 
    Commonly used by AI workers or Coaches to push new speeds or scores.
    """
    # exclude_unset=True ensures we only update fields the Coach actually sent
    updated = await PlayerRepository.update_stats(user_id, new_stats.model_dump(exclude_unset=True))
    
    if not updated:
        return {"message": "No changes detected", "current_stats": new_stats}
    
    # Notify player of manual stat update
    try:
        from app.core.repository import UserRepository
        from app.core.email import EmailService
        
        player_user = await UserRepository.get_user_by_id(user_id)
        if player_user and player_user.get("email"):
            await EmailService.send_analysis_notification(
                email=player_user["email"],
                player_name=player_user.get("full_name", "Operative"),
                metrics=new_stats.model_dump(exclude_unset=True)
            )
    except Exception as e:
        print(f"[NOTIF_ERROR] Failed to dispatch manual update alert: {e}")
    
    return {"message": "Stats updated successfully", "current_stats": new_stats}

# --- DELETE PROFILE ---
@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_player_profile(current_user: dict = Depends(get_current_user)):
    """
    Removes the cricket statistics profile. 
    Note: The core User account remains intact.
    """
    user_id = str(current_user["_id"])
    deleted = await PlayerRepository.delete_player_profile(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Player profile not found")
    return None

# --- LEADERBOARDS & DISCOVERY ---
@router.get("/leaderboard/top-speed", response_model=List[PlayerModel])
async def get_top_speed_leaderboard(limit: int = 10):
    """
    Ranks players by their AI-tracked 'top_speed_kph'.
    """
    players = await PlayerRepository.get_top_performers("performance_stats.top_speed_kph", limit)
    return players

@router.get("/team/{team_id}", response_model=List[PlayerModel])
async def get_team_roster(team_id: str):
    """
    Fetches all player profiles belonging to a specific team (e.g., THE REGENTS).
    """
    roster = await PlayerRepository.get_players_by_team(team_id)
    return roster

@router.post("/accept-invite/{team_id}")
async def accept_invitation(team_id: str, current_user: dict = Depends(get_current_user)):
    """
    Official endpoint for a player to join a team via a pending invite.
    """
    user_id = str(current_user["_id"])
    
    # 1. Verify invitation existence
    player = await PlayerRepository.get_player_by_user_id(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player profile not found")
        
    invites = player.get("invitations", [])
    has_invite = any(invite.get("team_id") == team_id for invite in invites)
    
    if not has_invite:
        raise HTTPException(status_code=400, detail="No active invitation found for this team")

    # 2. Process Acceptance
    success = await PlayerRepository.accept_team_invite(user_id, team_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to finalize team placement")
        
    return {"message": "Neural link established. Welcome to the squad.", "team_id": team_id}
