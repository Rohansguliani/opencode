CREATE VIRTUAL TABLE IF NOT EXISTS part_fts USING fts5(
  part_id UNINDEXED,
  message_id UNINDEXED,
  session_id UNINDEXED,
  project_id UNINDEXED,
  content
);

INSERT INTO part_fts(part_id, message_id, session_id, project_id, content)
SELECT 
  part.id, 
  part.message_id, 
  part.session_id, 
  session.project_id, 
  part.data->>'text'
FROM part
JOIN session ON session.id = part.session_id
WHERE part.data->>'type' = 'text' AND part.data->>'text' IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS part_ai AFTER INSERT ON part
WHEN (new.data->>'type') = 'text' AND (new.data->>'text') IS NOT NULL
BEGIN
  INSERT INTO part_fts(part_id, message_id, session_id, project_id, content)
  SELECT new.id, new.message_id, new.session_id, session.project_id, new.data->>'text'
  FROM session WHERE session.id = new.session_id;
END;

CREATE TRIGGER IF NOT EXISTS part_au AFTER UPDATE ON part
WHEN (new.data->>'type') = 'text' AND (new.data->>'text') IS NOT NULL
BEGIN
  UPDATE part_fts SET content = new.data->>'text' WHERE part_id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS part_ad AFTER DELETE ON part
BEGIN
  DELETE FROM part_fts WHERE part_id = old.id;
END;
