import sqlite3
conn = sqlite3.connect("memory_service/history.db")
c = conn.cursor()
try:
    c.execute("SELECT metadata FROM interactions LIMIT 1")
    print("Metadata column already exists.")
except sqlite3.OperationalError:
    print("Migrating table...")
    c.execute('''
        CREATE VIRTUAL TABLE interactions_new USING fts5(
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
    c.execute('''
        INSERT INTO interactions_new (agent_id, session_id, role, type, content, file_path, timestamp)
        SELECT agent_id, session_id, role, type, content, file_path, timestamp FROM interactions
    ''')
    c.execute('DROP TABLE interactions')
    c.execute('ALTER TABLE interactions_new RENAME TO interactions')
    conn.commit()
    print("Migration successful.")
