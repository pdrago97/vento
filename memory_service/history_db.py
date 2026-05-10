import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "history.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _init_db(conn)
    return conn

def _init_db(conn):
    c = conn.cursor()
    # Create the FTS5 virtual table
    c.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS interactions USING fts5(
            agent_id UNINDEXED,
            session_id UNINDEXED,
            role UNINDEXED,
            type UNINDEXED,
            content,
            file_path UNINDEXED,
            timestamp UNINDEXED,
            metadata UNINDEXED
        )
    ''')
    # Create reports table
    c.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT,
            title TEXT,
            content TEXT,
            timestamp REAL
        )
    ''')
    conn.commit()

def log_interaction(agent_id: str, session_id: str, role: str, interaction_type: str, content: str, file_path: str = "", metadata: dict = None):
    conn = get_connection()
    c = conn.cursor()
    import json
    metadata_str = json.dumps(metadata) if metadata else None
    c.execute('''
        INSERT INTO interactions (agent_id, session_id, role, type, content, file_path, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (agent_id, session_id, role, interaction_type, content, file_path, time.time(), metadata_str))
    conn.commit()

def search_history(agent_id: str, query: str, limit: int = 50):
    """
    Search the full-text content. 
    Note: For FTS5, if you want to filter by unindexed columns (agent_id), you just use WHERE.
    """
    conn = get_connection()
    c = conn.cursor()
    try:
        # FTS5 query format: enclose in double quotes to prevent syntax errors with hyphens etc.
        safe_query = query.replace('"', '""')
        match_query = f'"{safe_query}"'
        c.execute('''
            SELECT agent_id, session_id, role, type, content, file_path, timestamp, metadata
            FROM interactions
            WHERE interactions MATCH ?
              AND agent_id = ?
            ORDER BY rank
            LIMIT ?
        ''', (match_query, agent_id, limit))
        rows = c.fetchall()
        import json
        result = []
        for row in rows:
            d = dict(row)
            d['metadata'] = json.loads(d['metadata']) if d['metadata'] else None
            result.append(d)
        return result
    except Exception as e:
        print(f"Error in search_history: {e}")
        return []

# Ensure DB is created on load
get_connection()

def get_total_messages(agent_id: str) -> int:
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM interactions WHERE agent_id = ?', (agent_id,))
    res = c.fetchone()
    return res[0] if res else 0

def get_active_sessions(agent_id: str, hours: int = 24) -> int:
    conn = get_connection()
    c = conn.cursor()
    cutoff_time = time.time() - (hours * 3600)
    c.execute('SELECT COUNT(DISTINCT session_id) FROM interactions WHERE agent_id = ? AND timestamp >= ?', (agent_id, cutoff_time))
    res = c.fetchone()
    return res[0] if res else 0

def save_report(agent_id: str, title: str, content: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO reports (agent_id, title, content, timestamp)
        VALUES (?, ?, ?, ?)
    ''', (agent_id, title, content, time.time()))
    conn.commit()
    return c.lastrowid

def get_reports(agent_id: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT id, agent_id, title, content, timestamp FROM reports WHERE agent_id = ? ORDER BY timestamp DESC', (agent_id,))
    rows = c.fetchall()
    return [dict(row) for row in rows]

def delete_report(report_id: int, agent_id: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM reports WHERE id = ? AND agent_id = ?', (report_id, agent_id))
    conn.commit()

def get_recent_interactions(agent_id: str, limit: int = 50):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT session_id, role, type, content, timestamp, metadata
        FROM interactions
        WHERE agent_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (agent_id, limit))
    rows = c.fetchall()
    import json
    result = []
    for row in rows:
        d = dict(row)
        d['metadata'] = json.loads(d['metadata']) if d['metadata'] else None
        result.append(d)
    return result

def get_active_sessions_list(agent_id: str, hours: int = 24):
    conn = get_connection()
    c = conn.cursor()
    cutoff_time = time.time() - (hours * 3600)
    c.execute('''
        SELECT session_id, MAX(timestamp) as last_active, COUNT(*) as msg_count
        FROM interactions 
        WHERE agent_id = ? AND timestamp >= ?
        GROUP BY session_id
        ORDER BY last_active DESC
    ''', (agent_id, cutoff_time))
    rows = c.fetchall()
    return [dict(row) for row in rows]
