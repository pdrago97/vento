import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "history.db")

def get_connection():
    init_needed = not os.path.exists(DB_PATH)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    if init_needed:
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
            timestamp UNINDEXED
        )
    ''')
    conn.commit()

def log_interaction(agent_id: str, session_id: str, role: str, interaction_type: str, content: str, file_path: str = ""):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO interactions (agent_id, session_id, role, type, content, file_path, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (agent_id, session_id, role, interaction_type, content, file_path, time.time()))
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
            SELECT agent_id, session_id, role, type, content, file_path, timestamp 
            FROM interactions
            WHERE interactions MATCH ?
              AND agent_id = ?
            ORDER BY rank
            LIMIT ?
        ''', (match_query, agent_id, limit))
        rows = c.fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error in search_history: {e}")
        return []

# Ensure DB is created on load
get_connection()
