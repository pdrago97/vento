import time
import uuid
from graph_client import get_schema_client

def populate_tickets(agent_id="support"):
    print(f"Populating inventory for agent: {agent_id}")
    client = get_schema_client(agent_id)
    
    tickets = [
        {
            "id": f"ticket_{uuid.uuid4().hex[:8]}",
            "title": "Cannot login to Vento dashboard",
            "description": "User is getting a 403 Forbidden error when trying to access the main dashboard.",
            "status": "open",
            "priority": "high",
            "created_at": time.time() - 86400, # 1 day ago
            "user_id": "pedro_reichow"
        },
        {
            "id": f"ticket_{uuid.uuid4().hex[:8]}",
            "title": "Agent stops responding after 5 messages",
            "description": "The commercial agent seems to freeze after a short conversation. No errors in console.",
            "status": "investigating",
            "priority": "normal",
            "created_at": time.time() - 3600, # 1 hour ago
            "user_id": "pedro_reichow"
        },
        {
            "id": f"ticket_{uuid.uuid4().hex[:8]}",
            "title": "Feature request: Dark mode for Admin Chat",
            "description": "It would be great to have a dark mode toggle specifically for the admin interface.",
            "status": "closed",
            "priority": "low",
            "created_at": time.time() - 172800, # 2 days ago
            "user_id": "maria_silva"
        }
    ]
    
    for t in tickets:
        # Create Ticket node
        client.upsert_node(
            node_id=t["id"],
            label="Ticket",
            properties=t
        )
        
        # Create User node and relationship
        safe_user_id = t["user_id"].replace(" ", "_").lower()
        client.upsert_node(
            node_id=safe_user_id,
            label="User",
            properties={"name": t["user_id"]}
        )
        
        client.create_edge(
            source_id=safe_user_id,
            target_id=t["id"],
            relation="OPENED_TICKET"
        )
        print(f"Created ticket {t['id']} for user {t['user_id']}")
        
    print("Population complete.")

if __name__ == "__main__":
    populate_tickets()
