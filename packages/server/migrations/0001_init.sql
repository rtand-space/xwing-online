-- Cross-game index. The authoritative game log lives in each game's Durable
-- Object; D1 holds queryable metadata (listing, matchmaking, replay index later).

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_players (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (game_id, player_id)
);
