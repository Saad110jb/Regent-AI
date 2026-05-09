from fastapi import APIRouter, HTTPException, status, Depends
from app.models.team import TeamModel
from app.core.repository import TeamRepository, PlayerRepository
from app.api.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/teams", tags=["Teams & Management"])

# --- CREATE TEAM ---
@router.post("/")
async def create_team(team: TeamModel, current_user: dict = Depends(get_current_user)):
    """
    Creates a new team. The creator can be a Coach or a Player.
    Players must have an initialized profile first.
    """
    user_id = str(current_user["_id"])
    user_role = current_user.get("role")

    # 1. Coach-led logic
    if user_role == "coach":
        team.coach_id = user_id
        if not team.captain_id:
            team.captain_id = "TBD" # Can be assigned once players join
            
    # 2. Player-led logic (e.g., THE REGENTS)
    elif user_role in ["player", "captain"]:
        player = await PlayerRepository.get_player_by_user_id(user_id)
        if not player:
            raise HTTPException(
                status_code=400, 
                detail="Please initialize your Player profile before creating a team."
            )
        
        player_id = str(player["_id"])
        team.captain_id = player_id
        # Automatically add the creator to the roster
        if player_id not in team.player_ids:
            team.player_ids.append(player_id)
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role for team creation.")

    team_id = await TeamRepository.create_team(team.model_dump())
    return {"_id": team_id, **team.model_dump()}

# --- JOIN TEAM ---
@router.post("/join/{invite_code}")
async def join_team_by_code(invite_code: str, current_user: dict = Depends(get_current_user)):
    """
    Allows independent players to join a team using a unique invite code.
    """
    player = await PlayerRepository.get_player_by_user_id(str(current_user["_id"]))
    if not player:
        raise HTTPException(status_code=400, detail="Initialize your player profile first.")
    
    player_id = str(player["_id"])

    # Atomically add player to the team roster
    updated_team = await TeamRepository.add_player_to_team(invite_code, player_id)
    if not updated_team:
        raise HTTPException(status_code=404, detail="Invalid code or team is full.")

    # Update player's team reference
    await PlayerRepository.update_player_team(player_id, str(updated_team["_id"]))

    return {"status": "success"}

@router.post("/leave")
async def leave_team(current_user: dict = Depends(get_current_user)):
    """
    Allows a player to voluntarily resign from their current squad.
    """
    player = await PlayerRepository.get_player_by_user_id(str(current_user["_id"]))
    if not player or not player.get("team_id"):
        raise HTTPException(status_code=400, detail="You are not currently in a squad.")
    
    team_id = player["team_id"]
    
    # 1. Remove from team roster
    await TeamRepository.remove_player_from_team(team_id, str(current_user["_id"]))
    # Also handle if they were in player_ids as profile ID
    await TeamRepository.remove_player_from_team(team_id, str(player["_id"]))
    
    # 2. Update player profile
    await db_instance.db.players.update_one(
        {"_id": ObjectId(player["_id"])},
        {"$set": {"team_id": None, "squad_rank": None}}
    )
    
    return {"status": "success", "message": "Resignation processed."}

@router.delete("/{team_id}/player/{pid}")
async def remove_player_from_squad(
    team_id: str,
    pid: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows a coach to remove an operative from the squad.
    """
    # Verify Coach Authority
    team = await TeamRepository.get_team_by_id(team_id)
    if not team or team["coach_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized to manage this squad.")
        
    # 1. Remove from team roster (checks both formats)
    await TeamRepository.remove_player_from_team(team_id, pid)
    
    # 2. Find player and update their profile
    player = await PlayerRepository.get_player_by_id(pid) or await PlayerRepository.get_player_by_user_id(pid)
    if player:
        await db_instance.db.players.update_one(
            {"_id": ObjectId(player["_id"])},
            {"$set": {"team_id": None, "squad_rank": None}}
        )
        
    return {"status": "success", "message": "Operative removed from squad."}

# --- MANAGE ROSTER ---
@router.delete("/{team_id}/players/{player_id}")
async def remove_player(team_id: str, player_id: str, current_user: dict = Depends(get_current_user)):
    """
    Removes a player from the roster. Only Captains or Coaches have this authority.
    """
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
         raise HTTPException(status_code=404, detail="Team not found.")
         
    user_id = str(current_user["_id"])
    
    # Permission check for leadership
    is_coach = team.get("coach_id") == user_id
    player_profile = await PlayerRepository.get_player_by_user_id(user_id)
    is_captain = player_profile and str(player_profile["_id"]) == team.get("captain_id")

    if not is_coach and not is_captain:
        raise HTTPException(status_code=403, detail="Only team leadership can remove players.")

    await TeamRepository.remove_player_from_team(team_id, player_id)
    # Clear team reference on player profile
    await PlayerRepository.update_player_team(player_id, None)
    
    return {"message": "Player removed and profile updated."}

@router.get("/{team_id}")
async def get_team_detail(team_id: str):
    """
    Fetches the full team profile including coach and squad list.
    """
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team profile not found.")
    return team

@router.get("/{team_id}/neural-briefing")
async def get_team_neural_briefing(team_id: str, current_user: dict = Depends(get_current_user)):
    """
    Generates a squad-wide AI briefing for the coach.
    Analyzes team health, top performers, and overall tactical needs.
    """
    if current_user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can access neural briefings.")
        
    from app.core.repository import TeamRepository, AnalysisRepository
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Squad not found.")
        
    history = await AnalysisRepository.get_team_analysis_history(team_id)
    
    from app.core.advisory import NeuralCoach
    # We'll need a new method in NeuralCoach for this
    briefing = await NeuralCoach.get_squad_briefing(
        team_name=team.get("team_name", "Squad"),
        history=history
    )
    return {"briefing": briefing}

# --- PERFORMANCE ANALYTICS ---
@router.get("/{team_id}/stats")
async def get_team_stats(team_id: str):
    """
    Returns calculated win rates and match history for the team profile.
    """
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
        
    total_games = team["wins"] + team["losses"] + team["draws"]
    win_rate = (team["wins"] / total_games * 100) if total_games > 0 else 0
    
    return {
        "name": team["name"],
        "win_rate": f"{win_rate:.2f}%",
        "record": f"{team['wins']}W-{team['losses']}L-{team['draws']}D",
        "squad_count": len(team["player_ids"])
    }


@router.get("/coach/{coach_id}")
async def get_team_by_coach(coach_id: str):
    """Retrieves the team managed by a specific coach."""
    from app.core.database import db_instance
    team = await db_instance.db.teams.find_one({"coach_id": coach_id})
    if not team:
        raise HTTPException(status_code=404, detail="No team found for this coach.")
    team["_id"] = str(team["_id"])
    return team

async def verify_leadership(team: dict, user_id: str):
    """Checks if the user is the designated Coach or Captain of the team."""
    is_coach = team.get("coach_id") == user_id
    player_profile = await PlayerRepository.get_player_by_user_id(user_id)
    is_captain = player_profile and str(player_profile["_id"]) == team.get("captain_id")
    
    if not is_coach and not is_captain:
        raise HTTPException(status_code=403, detail="Leadership authority required.")
    return True

# --- RECRUITMENT ---
@router.post("/{team_id}/invite/{player_id}")
async def invite_player(team_id: str, player_id: str, current_user: dict = Depends(get_current_user)):
    """Sends an invite to a player's profile for them to accept."""
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    await verify_leadership(team, str(current_user["_id"]))

    if len(team.get("player_ids", [])) >= team.get("max_squad_size", 20):
        raise HTTPException(status_code=400, detail="Squad is full.")

    # Logic to send invite to the player's personal dashboard
    await PlayerRepository.send_team_invite(player_id, {
        "team_id": team_id,
        "team_name": team["name"],
        "invite_code": team["invite_code"],
        "created_at": datetime.now(timezone.utc)
    })

    return {"message": f"Invite sent to player {player_id} profile."}

@router.delete("/{team_id}/invite/{player_id}")
async def cancel_player_invite(
    team_id: str, 
    player_id: str, 
    current_user: dict = Depends(get_current_user)
):
    """Allows a coach to revoke a pending invitation sent to a player."""
    from app.core.database import db_instance
    from bson import ObjectId
    
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    await verify_leadership(team, str(current_user["_id"]))

    # We pull the invitation from the player's profile
    # Supports both profile _id and account user_id
    query = {"_id": ObjectId(player_id)} if ObjectId.is_valid(player_id) else {"user_id": player_id}
    
    # Matches either string or ObjectId version of team_id for robustness
    pull_match = {"team_id": team_id}
    if ObjectId.is_valid(team_id):
        pull_match = {"team_id": {"$in": [team_id, ObjectId(team_id)]}}

    result = await db_instance.db.players.update_one(
        query,
        {"$pull": {"invitations": pull_match}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found or player profile missing.")

    return {"message": f"Invitation to player {player_id} has been revoked."}

@router.get("/{team_id}/invites")
async def get_pending_invites(team_id: str, current_user: dict = Depends(get_current_user)):
    """Retrieves all pending invitations sent by this team."""
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    # Optional: verify leadership
    await verify_leadership(team, str(current_user["_id"]))
    
    invites = await PlayerRepository.get_pending_team_invites(team_id)
    return invites

class LeadershipUpdate(BaseModel):
    captain_id: str
    vice_captain_id: Optional[str] = None

# --- LEADERSHIP MANAGEMENT ---
@router.patch("/{team_id}/leadership")
async def update_leadership(
    team_id: str, 
    roles: LeadershipUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Updates leadership roles. Validates that selected players are already in the squad."""
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    await verify_leadership(team, str(current_user["_id"]))
    
    captain_id = roles.captain_id
    vice_captain_id = roles.vice_captain_id

    # 2. Robust Membership Verification
    # We check if the players are actually assigned to this team in their profiles
    # to handle mixed ID formats (User ID vs Player Profile ID)
    
    async def is_member(pid):
        p = await PlayerRepository.get_player_by_id(pid) or await PlayerRepository.get_player_by_user_id(pid)
        return p and p.get("team_id") == team_id

    if not await is_member(captain_id):
        raise HTTPException(status_code=400, detail="Captain must be an existing squad member.")
    
    if vice_captain_id and not await is_member(vice_captain_id):
        raise HTTPException(status_code=400, detail="Vice Captain must be an existing squad member.")

    await TeamRepository.update_team(team_id, {
        "captain_id": captain_id,
        "vice_captain_id": vice_captain_id
    })
    
    return {"message": "Leadership updated successfully."}

# --- ROSTER MANAGEMENT ---
@router.delete("/{team_id}/players/{player_id}")
async def remove_player(team_id: str, player_id: str, current_user: dict = Depends(get_current_user)):
    """Removes a player from the squad. Restricts removing the active Captain."""
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
        
    await verify_leadership(team, str(current_user["_id"]))

    if player_id == team.get("captain_id"):
        raise HTTPException(status_code=400, detail="Cannot remove the Captain. Reassign leadership first.")

    await TeamRepository.remove_player_from_team(team_id, player_id)
    await PlayerRepository.update_player_team(player_id, None)
    
    return {"message": "Player removed from roster."}

class TeamStatsUpdate(BaseModel):
    wins: Optional[int] = None
    losses: Optional[int] = None
    draws: Optional[int] = None

# --- STATS MANAGEMENT ---
@router.patch("/{team_id}/stats")
async def update_team_stats(
    team_id: str, 
    stats: TeamStatsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Manually update match results. Automatically increments total matches_played."""
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
        
    await verify_leadership(team, str(current_user["_id"]))
    
    # Recalculate matches played based on new totals
    new_wins = stats.wins if stats.wins is not None else team.get("wins", 0)
    new_losses = stats.losses if stats.losses is not None else team.get("losses", 0)
    new_draws = stats.draws if stats.draws is not None else team.get("draws", 0)
    
    update_data = {
        "wins": new_wins,
        "losses": new_losses,
        "draws": new_draws,
        "matches_played": new_wins + new_losses + new_draws
    }

    await TeamRepository.update_team(team_id, update_data)
    return {"message": "Stats updated", "new_record": f"{new_wins}W-{new_losses}L-{new_draws}D"}

class ChatSettingsUpdate(BaseModel):
    chat_retention_days: int

@router.patch("/{team_id}/chat-settings")
async def update_chat_settings(
    team_id: str,
    settings: ChatSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates the auto-delete policy for the squad chat. 
    Only the Coach can modify this.
    """
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
        
    if team.get("coach_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Only the coach can modify chat settings.")
        
    await TeamRepository.update_team(team_id, {"chat_retention_days": settings.chat_retention_days})
    return {"message": f"Chat retention updated to {settings.chat_retention_days} days."}

# --- PROFILE & ANALYTICS ---
@router.get("/{team_id}/full-profile")
async def get_team_full_profile(team_id: str):
    """Aggregates identity, leadership, squad details, and live win-rate analytics."""
    team = await TeamRepository.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
        
    wins = team.get("wins", 0)
    losses = team.get("losses", 0)
    draws = team.get("draws", 0)
    total = team.get("matches_played", (wins + losses + draws))
    
    win_rate = (wins / total * 100) if total > 0 else 0
    
    # Hydrate player IDs into full profile objects (names, positions, etc.)
    players_details = await PlayerRepository.get_players_by_ids(team.get("player_ids", []))
    
    return {
        "identity": {
            "name": team["name"],
            "logo": team.get("team_logo"),
            "location": team["location"],
            "description": team.get("description")
        },
        "leadership": {
            "captain": team.get("captain_id"),
            "vice_captain": team.get("vice_captain_id"),
            "coach": team.get("coach_id")
        },
        "analytics": {
            "win_rate": f"{win_rate:.2f}%",
            "record": f"{wins}W-{losses}L-{draws}D",
            "total_matches": total
        },
        "squad": players_details,
        "invite_code": team["invite_code"]
    }
