from app.core.database import db_instance
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime,timezone
class UserRepository:
    @staticmethod
    async def create_user(user_data: dict) -> str:
        """Saves a new user to the users collection."""
        result = await db_instance.db.users.insert_one(user_data)
        return str(result.inserted_id)

    @staticmethod
    async def get_user_by_email(email: str):
        """Retrieves a user by their email address."""
        user = await db_instance.db.users.find_one({"email": email})
        if user:
            user["_id"] = str(user["_id"])
        return user

    @staticmethod
    async def get_user_by_id(user_id: str):
        """Retrieves a user by their MongoDB ObjectId."""
        user = await db_instance.db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            user["_id"] = str(user["_id"])
        return user

    @staticmethod
    async def update_login_metadata(user_id: str, ip: str):
        """Updates the last login time and IP address for a user."""
        from bson import ObjectId
        from app.core.database import db_instance
        
        await db_instance.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "last_login": datetime.now(timezone.utc), # Modern replacement for utcnow()
                    "last_ip": ip
                }
            }
        )
        
class PlayerRepository:
    @staticmethod
    async def get_player_by_id(player_id: str) -> Optional[dict]:
        """Fetches a player profile by its internal MongoDB _id."""
        if not ObjectId.is_valid(player_id):
            return None
        player = await db_instance.db.players.find_one({"_id": ObjectId(player_id)})
        if player:
            player["_id"] = str(player["_id"])
        return player

    @staticmethod
    async def get_player_by_user_id(user_id: str) -> Optional[Dict[str, Any]]:
        # This handles both cases:
        # 1. Searching by Player Profile _id (e.g. from Manage Team)
        # 2. Searching by User account ID (e.g. from Player Dashboard)
        query = {
            "$or": [
                {"user_id": user_id}
            ]
        }
        if ObjectId.is_valid(user_id):
            query["$or"].append({"_id": ObjectId(user_id)})
            
        player = await db_instance.db.players.find_one(query)
        if player:
            player["_id"] = str(player["_id"])
        return player

    @staticmethod
    async def upsert_player_profile(player_data: Dict[str, Any]) -> bool:
        """Creates or updates a player profile."""
        result = await db_instance.db.players.update_one(
            {"user_id": player_data["user_id"]},
            {"$set": player_data},
            upsert=True
        )
        return result.acknowledged

    @staticmethod
    async def update_player_team(player_id: str, team_id: Optional[str]):
        """Links or unlinks a player to a team."""
        await db_instance.db.players.update_one(
            {"_id": ObjectId(player_id)},
            {"$set": {"team_id": team_id}}
        )
    
    @staticmethod
    async def search_players(query: str):
     # 1. First, find users who match the name/email query
     user_query = {
         "role": "player",
         "$or": [
             {"full_name": {"$regex": query, "$options": "i"}},
             {"email": {"$regex": query, "$options": "i"}}
         ]
     }
     users_cursor = db_instance.db.users.find(user_query).limit(10)
     users = await users_cursor.to_list(length=10)
     
     matched_user_ids = [str(u["_id"]) for u in users]
     
     # 2. Now, build a pipeline that finds players who either match the query 
     # OR belong to the matched users.
     pipeline = [
        {
            "$match": {
                "$or": [
                    {"user_id": {"$in": matched_user_ids}},
                    {"user_id": {"$regex": query, "$options": "i"}}, # If query is a user_id
                    {"player_type": {"$regex": query, "$options": "i"}}
                ]
            }
        },
        {
            "$lookup": {
                "from": "users",
                "let": {"search_id": "$user_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$or": [
                                    {"$eq": ["$_id", "$$search_id"]}, # Case: user_id is ObjectId
                                    {"$eq": [{"$toString": "$_id"}, "$$search_id"]} # Case: user_id is String
                                ]
                            }
                        }
                    }
                ],
                "as": "user_info"
            }
        },
        {
            "$unwind": {
                "path": "$user_info",
                "preserveNullAndEmptyArrays": True
            }
        },
        {"$limit": 10}
    ]
    
     cursor = db_instance.db.players.aggregate(pipeline)
     results = await cursor.to_list(length=10)
    
     # Flatten the result for the frontend
     for res in results:
        res["_id"] = str(res["_id"])
        if "user_info" in res:
            res["name"] = res["user_info"].get("full_name", "Unknown")
            res["email"] = res["user_info"].get("email", "N/A")
            del res["user_info"] # Clean up the object
            
     return results

    @staticmethod
    async def get_players_by_ids(player_ids: List[str]):
        """Fetches multiple player documents joined with user info. Handles both _id and user_id formats."""
        if not player_ids:
            return []
            
        # Convert valid strings to ObjectIds for the _id field match
        obj_ids = [ObjectId(pid) for pid in player_ids if ObjectId.is_valid(pid)]
        
        pipeline = [
            {
                "$match": {
                    "$or": [
                        {"_id": {"$in": obj_ids}},
                        {"user_id": {"$in": player_ids}}
                    ]
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "let": {"search_id": "$user_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$_id", "$$search_id"]},
                                        {"$eq": [{"$toString": "$_id"}, "$$search_id"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "user_info"
                }
            },
            {"$unwind": "$user_info"},
            {
                "$project": {
                    "_id": {"$toString": "$_id"},
                    "name": "$user_info.full_name",
                    "email": "$user_info.email",
                    "player_type": 1,
                    "performance_stats": 1,
                    "team_id": 1,
                    "user_id": 1
                }
            }
        ]
        cursor = db_instance.db.players.aggregate(pipeline)
        return await cursor.to_list(length=len(player_ids))

    @staticmethod
    async def get_pending_team_invites(team_id: str):
        """Finds all players who have a pending invite from this team."""
        pipeline = [
            {"$match": {"invitations.team_id": team_id}},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"search_id": "$user_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$_id", "$$search_id"]},
                                        {"$eq": [{"$toString": "$_id"}, "$$search_id"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "user_info"
                }
            },
            {"$unwind": "$user_info"},
            {
                "$project": {
                    "_id": {"$toString": "$_id"},
                    "name": "$user_info.full_name",
                    "email": "$user_info.email"
                }
            }
        ]
        cursor = db_instance.db.players.aggregate(pipeline)
        return await cursor.to_list(length=20)

    @staticmethod
    async def send_team_invite(player_id: str, invite_data: dict) -> bool:
        """Appends an invite object to the player's invitations array."""
        # Note: player_id is the string user_id, which corresponds to the player document's user_id or _id?
        # Usually player_id in team endpoints refers to the player's _id or user_id. 
        # In our schema, user_id is the primary reference. Let's use user_id or _id based on what's passed.
        # Actually, recruit_player passes `player_id`. Wait.
        # Looking at team.py: recruit_player(team_id: str, player_id: str).
        # We'll assume player_id is the ObjectId of the player document, or we can check.
        # Let's support both or just use ObjectId(player_id) if it is valid.
        query = {"_id": ObjectId(player_id)} if ObjectId.is_valid(player_id) else {"user_id": player_id}
        result = await db_instance.db.players.update_one(
            query,
            {"$push": {"invitations": invite_data}}
        )
        return result.modified_count > 0

    @staticmethod
    async def remove_team_invite(user_id: str, team_id: str) -> bool:
        """Removes a specific team invite from the player's invitations array."""
        result = await db_instance.db.players.update_one(
            {"user_id": user_id},
            {"$pull": {"invitations": {"team_id": team_id}}}
        )
        return result.modified_count > 0

    @staticmethod
    async def accept_team_invite(user_id: str, team_id: str) -> bool:
        """Official handshake: Joins a player to a team and clears the invite."""
        # 1. Update Player document
        result = await db_instance.db.players.update_one(
            {"user_id": user_id},
            {
                "$set": {"team_id": team_id},
                "$pull": {"invitations": {"team_id": team_id}}
            }
        )
        
        if result.modified_count > 0:
            # 2. Add player to Team's player_ids array
            await db_instance.db.teams.update_one(
                {"_id": ObjectId(team_id)},
                {"$addToSet": {"player_ids": user_id}}
            )
            return True
        return False
    @staticmethod
    async def update_stats(user_id: str, stats_data: Dict[str, Any]) -> bool:
        """Updates nested performance_stats (e.g., top_speed_kph) and calculates rolling average."""
        player = await db_instance.db.players.find_one({"user_id": user_id})
        if not player:
            return False

        current_stats = player.get("performance_stats", {})
        current_avg = current_stats.get("average_speed_kph", 0.0)
        current_count = current_stats.get("sessions_count", 0)
        
        new_top_speed = stats_data.get("top_speed_kph", 0.0)
        
        if new_top_speed > 0:
            # Calculate rolling average
            new_avg = ((current_avg * current_count) + new_top_speed) / (current_count + 1)
            stats_data["average_speed_kph"] = round(new_avg, 2)
            stats_data["sessions_count"] = current_count + 1
            
            # Keep the absolute highest speed as top_speed_kph
            if new_top_speed < current_stats.get("top_speed_kph", 0.0):
                stats_data["top_speed_kph"] = current_stats.get("top_speed_kph", 0.0)
        
        # Merge old stats with new stats
        merged_stats = {**current_stats, **stats_data}

        result = await db_instance.db.players.update_one(
            {"user_id": user_id},
            {"$set": {"performance_stats": merged_stats}}
        )
        
        team_id = player.get("team_id")
        if team_id:
            await PlayerRepository.recalculate_squad_ranks(team_id)
            
        return result.modified_count > 0

    @staticmethod
    async def recalculate_squad_ranks(team_id: str):
        """Calculates and updates squad_rank for all players in a team based on average_speed_kph."""
        cursor = db_instance.db.players.find({"team_id": team_id}).sort("performance_stats.average_speed_kph", -1)
        players = await cursor.to_list(length=100)
        
        for index, player in enumerate(players):
            rank = index + 1
            await db_instance.db.players.update_one(
                {"_id": player["_id"]},
                {"$set": {"squad_rank": rank}}
            )

    @staticmethod
    async def delete_player_profile(user_id: str) -> bool:
        result = await db_instance.db.players.delete_one({"user_id": user_id})
        return result.deleted_count > 0

    @staticmethod
    async def get_top_performers(sort_field: str, limit: int) -> List[Dict[str, Any]]:
        cursor = db_instance.db.players.find().sort(sort_field, -1).limit(limit)
        players = await cursor.to_list(length=limit)
        for p in players:
            p["_id"] = str(p["_id"])
        return players
class TeamRepository:
    @staticmethod
    async def create_team(team_data: Dict[str, Any]) -> str:
        """Inserts a new team document into the database."""
        result = await db_instance.db.teams.insert_one(team_data)
        return str(result.inserted_id)

    @staticmethod
    async def get_team_by_id(team_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a team by its MongoDB ObjectId."""
        if not ObjectId.is_valid(team_id):
            return None
        team = await db_instance.db.teams.find_one({"_id": ObjectId(team_id)})
        if team:
            team["_id"] = str(team["_id"])
            # Hardening leadership IDs for JSON safety
            for field in ["coach_id", "captain_id", "vice_captain_id"]:
                if team.get(field):
                    team[field] = str(team[field])
        return team

    @staticmethod
    async def update_team(team_id: str, update_data: Dict[str, Any]):
        """
        General purpose patch method for updating any team field 
        (e.g., logo, description, leadership, or stats).
        """
        if not ObjectId.is_valid(team_id):
            return None
        await db_instance.db.teams.update_one(
            {"_id": ObjectId(team_id)},
            {"$set": update_data}
        )

    @staticmethod
    async def add_player_to_team(invite_code: str, player_id: str) -> Optional[Dict[str, Any]]:
        """
        Atomically adds a player to the roster if not already present.
        Ensures the squad does not exceed max_squad_size.
        """
        team = await db_instance.db.teams.find_one_and_update(
            {
                "invite_code": invite_code,
                "$expr": {"$lt": [{"$size": "$player_ids"}, "$max_squad_size"]}
            },
            {"$addToSet": {"player_ids": player_id}},
            return_document=True
        )
        if team:
            team["_id"] = str(team["_id"])
        return team

    @staticmethod
    async def remove_player_from_team(team_id: str, player_id: str):
        """Removes a player ID from the player_ids array."""
        if not ObjectId.is_valid(team_id):
            return
        await db_instance.db.teams.update_one(
            {"_id": ObjectId(team_id)},
            {"$pull": {"player_ids": player_id}}
        )

    @staticmethod
    async def update_team_stats(team_id: str, wins: int, losses: int, draws: int):
        """
        Updates match records and automatically synchronizes the 
        matches_played field based on the new totals.
        """
        if not ObjectId.is_valid(team_id):
            return
            
        total_matches = wins + losses + draws
        await db_instance.db.teams.update_one(
            {"_id": ObjectId(team_id)},
            {
                "$set": {
                    "wins": wins,
                    "losses": losses,
                    "draws": draws,
                    "matches_played": total_matches
                }
            }
        )

    @staticmethod
    async def get_players_by_team(team_id: str) -> List[Dict[str, Any]]:
        """
        Finds all player profile documents where the team_id matches.
        Used for hydrating the squad list in the full profile.
        """
        cursor = db_instance.db.players.find({"team_id": team_id})
        players = await cursor.to_list(length=100)
        for p in players:
            p["_id"] = str(p["_id"])
        return players
class SubscriptionRepository:

    @staticmethod
    async def create_subscription(sub_data: dict):
        from app.core.database import db_instance
        result = await db_instance.db.subscriptions.insert_one(sub_data)
        # Also update the User's subscription_tier in the users collection
        await db_instance.db.users.update_one(
            {"_id": ObjectId(sub_data["user_id"])},
            {"$set": {"subscription_tier": sub_data["tier"]}}
        )
        return result.inserted_id

    @staticmethod
    async def get_active_subscription(user_id: str):
        from app.core.database import db_instance
        # Finds the most recent active/trailing subscription
        return await db_instance.db.subscriptions.find_one(
            {"user_id": user_id, "status": {"$in": ["active", "trailing"]}},
            sort=[("start_date", -1)]
        )

    @staticmethod
    async def cancel_subscription(user_id: str):
        from app.core.database import db_instance
        from datetime import datetime, timezone
        result = await db_instance.db.subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": {"auto_renew": False, "cancelled_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0

    @staticmethod
    async def update_status(subscription_id: str, new_status: str):
        from app.core.database import db_instance
        await db_instance.db.subscriptions.update_one(
            {"subscription_id": subscription_id},
            {"$set": {"status": new_status}}
        )

class TransactionRepository:
    @staticmethod
    async def log_transaction(txn_data: dict):
        """Logs a payment attempt (initiated/pending/success) to the ledger."""
        return await db_instance.db.transactions.insert_one(txn_data)

    @staticmethod
    async def update_transaction_status(txn_id: str, status: str, gateway_response: dict = None):
        """Updates the status of a transaction after gateway confirmation."""
        update_fields = {"status": status, "updated_at": datetime.now(timezone.utc)}
        if gateway_response:
            update_fields["gateway_response"] = gateway_response
            
        await db_instance.db.transactions.update_one(
            {"transaction_id": txn_id},
            {"$set": update_fields}
        )
class PlanRepository:
    @staticmethod
    async def create_plan(plan_data: dict) -> bool:
        from app.core.database import db_instance
        result = await db_instance.db.plans.insert_one(plan_data)
        return result.acknowledged

    @staticmethod
    async def get_active_plans() -> List[dict]:
        from app.core.database import db_instance
        cursor = db_instance.db.plans.find({"is_active": True})
        return await cursor.to_list(length=20)

    @staticmethod
    async def get_plan_by_id(plan_id: str) -> Optional[dict]:
        from app.core.database import db_instance
        return await db_instance.db.plans.find_one({"plan_id": plan_id})
    

    
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.core.database import db_instance

# ... (Previous UserRepository, PlayerRepository, etc.)

class VideoRepository:
    @staticmethod
    async def create_video_metadata(video_data: Dict[str, Any]) -> bool:
        """Initializes a record for a new video upload."""
        result = await db_instance.db.videos.insert_one(video_data)
        return result.acknowledged

    @staticmethod
    async def update_video_status(video_id: str, status: str, error_message: Optional[str] = None):
        """Updates the processing status (pending/processing/completed/failed)."""
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        if error_message:
            update_data["error_message"] = error_message
        if status == "completed":
            update_data["processed_at"] = datetime.now(timezone.utc)

        await db_instance.db.videos.update_one(
            {"video_id": video_id}, 
            {"$set": update_data}
        )

    @staticmethod
    async def get_videos_by_user(user_id: str) -> List[Dict[str, Any]]:
        """Retrieves videos uploaded by a specific user that are less than 24 hours old."""
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        
        cursor = db_instance.db.videos.find({
            "user_id": user_id,
            "uploaded_at": {"$gte": cutoff}
        }).sort("uploaded_at", -1)
        
        videos = await cursor.to_list(length=100)
        for v in videos:
            v["_id"] = str(v["_id"])
        return videos

    @staticmethod
    async def get_video_by_id(video_id: str) -> Optional[Dict[str, Any]]:
        """Fetches metadata for a specific video."""
        video = await db_instance.db.videos.find_one({"video_id": video_id})
        if video:
            video["_id"] = str(video["_id"])
        return video


class AnalysisRepository:
    @staticmethod
    async def save_analysis_result(analysis_data: Dict[str, Any]) -> bool:
        """Saves the detailed physics and form results from the AI Worker."""
        result = await db_instance.db.analysis.insert_one(analysis_data)
        
        # Optional: If this is a top speed, update the player's personal best
        if analysis_data.get("top_speed_kph", 0) > 0:
            from app.core.repository import PlayerRepository
            await PlayerRepository.update_stats(
                analysis_data["user_id"], 
                {"top_speed_kph": analysis_data["top_speed_kph"]}
            )
            
        return result.acknowledged

    @staticmethod
    async def get_analysis_by_video(video_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves the AI insights (KPH, arm angles, pathing) for a specific video."""
        analysis = await db_instance.db.analysis.find_one({"video_id": video_id})
        if analysis:
            analysis["_id"] = str(analysis["_id"])
        return analysis

    @staticmethod
    async def get_user_performance_history(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves AI analysis sessions for a player within the last 24 hours (Naive-Safe)."""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(hours=24)
        
        cursor = db_instance.db.analysis.find({
            "user_id": user_id,
            "created_at": {"$gte": cutoff}
        }).sort("created_at", -1).limit(limit)
        
        results = await cursor.to_list(length=limit)
        for res in results:
            res["_id"] = str(res["_id"])
            # Hardening linked IDs
            for field in ["user_id", "player_id", "coach_id"]:
                if field in res:
                    res[field] = str(res[field])
        return results

    @staticmethod
    async def get_team_analysis_history(team_id: str) -> List[Dict[str, Any]]:
        """Aggregates recent (24h) AI sessions for an entire squad (Naive-Safe)."""
        from datetime import datetime, timedelta
        from app.core.repository import TeamRepository
        cutoff = datetime.utcnow() - timedelta(hours=24)
        
        # 1. Get all players in the team
        team = await TeamRepository.get_team_by_id(team_id)
        if not team:
            return []
        player_user_ids = team.get("player_ids", [])
        
        # 2. Pre-fetch names for efficiency (mapping both User IDs and Profile IDs)
        initial_ids = [ObjectId(uid) for uid in player_user_ids if ObjectId.is_valid(uid)]
        
        # Get player profiles to find linked user IDs (in case team list has profile IDs)
        player_cursor = db_instance.db.players.find({"_id": {"$in": initial_ids}})
        players_list = await player_cursor.to_list(length=100)
        
        # Aggregate all relevant User IDs
        lookup_user_ids = set(player_user_ids)
        for p in players_list:
            if p.get("user_id"):
                lookup_user_ids.add(str(p["user_id"]))
        
        # Fetch all these users
        user_cursor = db_instance.db.users.find({"_id": {"$in": [ObjectId(uid) for uid in lookup_user_ids if ObjectId.is_valid(uid)]}})
        users_list = await user_cursor.to_list(length=100)
        
        name_map = {}
        # Map User ID -> Name
        for u in users_list:
            name_map[str(u["_id"])] = u.get("full_name", "Unknown")
            
        # Map Profile ID -> Name (using the linked user name)
        for p in players_list:
            prof_id = str(p["_id"])
            user_id = str(p.get("user_id"))
            if user_id in name_map:
                name_map[prof_id] = name_map[user_id]
            elif prof_id not in name_map:
                name_map[prof_id] = "Squad Operative"
        
        # 3. Fetch history for all those players (Check both user_id and player_id fields)
        cursor = db_instance.db.analysis.find({
            "$or": [
                {"user_id": {"$in": player_user_ids}},
                {"player_id": {"$in": player_user_ids}}
            ],
            "created_at": {"$gte": cutoff}
        }).sort("created_at", -1)
        
        results = await cursor.to_list(length=50)
        
        # Hydrate with player names and ensure JSON safety
        for res in results:
            # Try to get name from either mapped ID
            res["player_name"] = name_map.get(str(res.get("user_id")), 
                                           name_map.get(str(res.get("player_id")), "Unknown Operative"))
            res["_id"] = str(res["_id"])
            # Hardening linked IDs
            for field in ["user_id", "player_id", "coach_id"]:
                if field in res:
                    res[field] = str(res[field])
            
        return results
    

class SecurityRepository:
    @staticmethod
    async def get_security_settings(user_id: str):
        from app.core.database import db_instance
        res = await db_instance.db.security_settings.find_one({"user_id": user_id})
        if res:
            res["_id"] = str(res["_id"])
        return res

    @staticmethod
    async def upsert_security_settings(data: dict):
        from app.core.database import db_instance
        return await db_instance.db.security_settings.update_one(
            {"user_id": data["user_id"]}, {"$set": data}, upsert=True
        )

    @staticmethod
    async def log_audit(log_data: dict):
        """Records a security event in the audit_logs collection."""
        from app.core.database import db_instance
        # Ensure timestamp is UTC
        log_data["timestamp"] = datetime.now(timezone.utc)
        return await db_instance.db.audit_logs.insert_one(log_data)

    @staticmethod
    async def get_user_logs(user_id: str, limit: int = 10):
        from app.core.database import db_instance
        cursor = db_instance.db.audit_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(limit)
        logs = await cursor.to_list(length=limit)
        for log in logs:
            log["_id"] = str(log["_id"])
        return logs

    @staticmethod
    async def update_2fa_status(user_id: str, enabled: bool):
        from app.core.database import db_instance
        result = await db_instance.db.security_settings.update_one(
            {"user_id": user_id},
            {"$set": {"two_factor_enabled": enabled}}
        )
        return result.acknowledged

    @staticmethod
    async def set_otp(user_id: str, code: str):
        from app.core.database import db_instance
        # Store OTP in security settings temporarily
        await db_instance.db.security_settings.update_one(
            {"user_id": user_id},
            {"$set": {"current_otp": code, "otp_expiry": datetime.now(timezone.utc)}}
        )

    @staticmethod
    async def verify_otp(user_id: str, code: str) -> bool:
        from app.core.database import db_instance
        security = await db_instance.db.security_settings.find_one({"user_id": user_id})
        if not security:
            return False
        
        stored_code = security.get("current_otp")
        if stored_code == code:
            # Clear the OTP after successful verification
            await db_instance.db.security_settings.update_one(
                {"user_id": user_id},
                {"$unset": {"current_otp": "", "otp_expiry": ""}}
            )
            return True
        return False

class SettingsRepository:
    @staticmethod
    async def get_preferences(user_id: str):
        from app.core.database import db_instance
        res = await db_instance.db.user_settings.find_one({"user_id": user_id})
        if res:
            res["_id"] = str(res["_id"])
        return res

    @staticmethod
    async def update_preferences(user_id: str, updates: dict):
        from app.core.database import db_instance
        result = await db_instance.db.user_settings.update_one(
            {"user_id": user_id}, {"$set": updates}, upsert=True
        )
        return result.acknowledged