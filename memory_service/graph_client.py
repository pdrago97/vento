from falkordb import FalkorDB
import json
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from embedding import get_embedding

class OpenClawGraph:
    def __init__(self, host='localhost', port=6380, graph_name='openclaw'):
        self.db = FalkorDB(host=host, port=port)
        self.graph = self.db.select_graph(graph_name)
        self._init_schema()

    def _init_schema(self):
        # Create vector index on Fact nodes if not exists
        try:
            self.graph.query("CREATE VECTOR INDEX FOR (f:Fact) ON (f.embedding) OPTIONS {dimension: 3072, similarityFunction: 'cosine'}")
        except Exception as e:
            if "already indexed" not in str(e):
                print(f"Error creating vector index: {e}")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def store_fact(self, user_id: str, subject: str, predicate: str, object_val: str, timestamp: float, source_channel: str):
        """Stores a fact in the Knowledge Graph and invalidates conflicting old facts."""
        
        # 1. Deprecate previous facts with the same subject and predicate for this user
        # This handles conflict resolution (e.g. "favorite color is blue" -> "favorite color is green")
        # We find existing facts, mark them inactive
        deprecate_q = """
        MATCH (u:User {id: $user_id})-[:KNOWS]->(f:Fact {subject: $subject, predicate: $predicate, status: 'active'})
        SET f.status = 'inactive'
        """
        await asyncio.to_thread(self.graph.query, deprecate_q, {'user_id': user_id, 'subject': subject, 'predicate': predicate})

        # 2. Insert the new fact
        text_representation = f"{subject} {predicate} {object_val}"
        embedding = await get_embedding(text_representation)
        
        insert_q = """
        MERGE (u:User {id: $user_id})
        CREATE (f:Fact {
            subject: $subject, 
            predicate: $predicate, 
            object: $object_val, 
            timestamp: $timestamp, 
            source_channel: $source_channel,
            status: 'active'
        })
        CREATE (u)-[:KNOWS]->(f)
        """
        # FalkorDB python client supports passing vector embeddings directly, but 
        # setting node properties directly might require proper vector syntax.
        # Let's execute the main node creation, then call a vector set query.
        
        await asyncio.to_thread(self.graph.query, insert_q, {
            'user_id': user_id,
            'subject': subject,
            'predicate': predicate,
            'object_val': object_val,
            'timestamp': timestamp,
            'source_channel': source_channel
        })

        # Attach embedding (Requires vector syntax)
        emb_q = """
        MATCH (u:User {id: $user_id})-[:KNOWS]->(f:Fact {subject: $subject, predicate: $predicate, object: $object_val, timestamp: $timestamp})
        CALL db.idx.vector.add(f, 'embedding', $embedding) YIELD node
        RETURN node
        """
        try:
            # We will just set it as a property since vector functions might differ depending on FalkorDB version.
            # In FalkorDB, you can assign it as a list.
            set_vec_q = """
            MATCH (u:User {id: $user_id})-[:KNOWS]->(f:Fact {subject: $subject, predicate: $predicate, object: $object_val, timestamp: $timestamp})
            SET f.embedding = vecf32($embedding)
            """
            await asyncio.to_thread(self.graph.query, set_vec_q, {
                'user_id': user_id,
                'subject': subject,
                'predicate': predicate,
                'object_val': object_val,
                'timestamp': timestamp,
                'embedding': embedding
            })
        except Exception as e:
            print("Error setting embedding:", e)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def retrieve_relevant_facts(self, user_id: str, query_text: str, top_k: int = 3) -> list[str]:
        """Performs semantic search to inject relevant facts into context."""
        query_emb = await get_embedding(query_text)
        
        # Semantic search using Vector Index
        search_q = """
        MATCH (u:User {id: $user_id})-[:KNOWS]->(f:Fact {status: 'active'})
        WITH f, vec.cosineDistance(f.embedding, vecf32($query_emb)) AS dist
        ORDER BY dist ASC
        LIMIT $top_k
        RETURN f.subject, f.predicate, f.object, dist
        """
        try:
            res = await asyncio.to_thread(self.graph.query, search_q, {
                'user_id': user_id,
                'query_emb': query_emb,
                'top_k': top_k
            })
            
            facts = []
            for record in res.result_set:
                sub, pred, obj, dist = record
                # We can filter out facts that are too semantically distant if needed
                if dist < 0.5: # Example threshold
                    facts.append(f"{sub} {pred} {obj}")
            return facts
        except Exception as e:
            print("Search error:", e)
            # Fallback if vector index fails: return latest active facts
            fallback_q = """
            MATCH (u:User {id: $user_id})-[:KNOWS]->(f:Fact {status: 'active'})
            RETURN f.subject, f.predicate, f.object
            ORDER BY f.timestamp DESC
            LIMIT $top_k
            """
            res = await asyncio.to_thread(self.graph.query, fallback_q, {'user_id': user_id, 'top_k': top_k})
            return [f"{r[0]} {r[1]} {r[2]}" for r in res.result_set]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def get_graph_data(self):
        """Returns all nodes and links for UI visualization, excluding large embeddings."""
        nodes_q = "MATCH (n) RETURN n"
        edges_q = "MATCH ()-[r]->() RETURN r"
        
        nodes_res = await asyncio.to_thread(self.graph.query, nodes_q)
        edges_res = await asyncio.to_thread(self.graph.query, edges_q)
        
        nodes = []
        internal_to_prop_id = {}
        for record in nodes_res.result_set:
            n = record[0]
            props = n.properties.copy() if hasattr(n, 'properties') and n.properties else {}
            if 'embedding' in props:
                del props['embedding']
            
            node_id = props.get('id', str(n.id))
            internal_to_prop_id[n.id] = node_id
                
            nodes.append({
                "id": node_id,
                "internal_id": n.id,
                "label": n.labels[0] if n.labels else "Unknown",
                "properties": props
            })
            
        links = []
        for record in edges_res.result_set:
            r = record[0]
            source_id = internal_to_prop_id.get(r.src_node, str(r.src_node))
            target_id = internal_to_prop_id.get(r.dest_node, str(r.dest_node))
            links.append({
                "id": r.id,
                "source": source_id,
                "target": target_id,
                "label": r.relation,
                "properties": r.properties if hasattr(r, 'properties') and r.properties else {}
            })
        return {"nodes": nodes, "links": links}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def upsert_node(self, node_id: str, label: str, properties: dict):
        """Creates or updates a node."""
        props = properties.copy()
        if 'id' not in props:
            props['id'] = node_id
        
        safe_label = "".join(c for c in label if c.isalnum() or c == '_')
        if not safe_label:
            safe_label = "Node"

        q = f"MERGE (n:{safe_label} {{id: $node_id}}) SET n = $props RETURN n"
        await asyncio.to_thread(self.graph.query, q, {'node_id': node_id, 'props': props})
        return True

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def create_edge(self, source_id: str, target_id: str, relation: str, properties: dict = None):
        """Creates an edge between two nodes."""
        props = properties if properties else {}
        safe_rel = "".join(c for c in relation if c.isalnum() or c == '_')
        if not safe_rel:
            safe_rel = "RELATED_TO"
            
        q = f"""
        MATCH (a), (b)
        WHERE a.id = $source_id AND b.id = $target_id
        MERGE (a)-[r:{safe_rel}]->(b)
        SET r += $props
        RETURN r
        """
        await asyncio.to_thread(self.graph.query, q, {'source_id': source_id, 'target_id': target_id, 'props': props})
        return True

    def seed_schema(self):
        """Seeds the schema graph with basic ontology classes if empty."""
        res = self.graph.query("MATCH (n) RETURN count(n)")
        count = res.result_set[0][0]
        if count == 0:
            self.graph.query("CREATE (:Class {id: 'User', name: 'User'})")
            self.graph.query("CREATE (:Class {id: 'Entity', name: 'Entity'})")
            self.graph.query("CREATE (:Class {id: 'Fact', name: 'Fact'})")
            self.graph.query("CREATE (:Class {id: 'Interaction', name: 'Interaction'})")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def store_interaction(self, session_id: str, role: str, interaction_type: str, content: str, metadata: dict = None, user_id: str = None):
        import uuid
        import time
        interaction_id = f"int_{uuid.uuid4().hex[:8]}"
        
        props = {
            "id": interaction_id,
            "session_id": session_id,
            "role": role,
            "type": interaction_type,
            "content": content,
            "timestamp": time.time()
        }
        
        if metadata:
            for k, v in metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    props[k] = v
                else:
                    props[k] = str(v)
                    
        # Create Interaction node and link to User if user_id is provided
        q = """
        MERGE (u:Entity {id: $user_id})
        ON CREATE SET u.name = $user_id
        CREATE (i:Interaction)
        SET i = $props
        CREATE (u)-[:ENGAGED_IN]->(i)
        RETURN i
        """
        safe_user_id = "unknown_user"
        if user_id:
            safe_user_id = "".join(c for c in user_id if c.isalnum() or c == '_').lower()
        elif metadata and "user_id" in metadata:
            safe_user_id = "".join(c for c in str(metadata["user_id"]) if c.isalnum() or c == '_').lower()
            
        if not safe_user_id:
            safe_user_id = "unknown_user"
            
        await asyncio.to_thread(self.graph.query, q, {'user_id': safe_user_id, 'props': props})
        return interaction_id

graph_client = OpenClawGraph(graph_name='openclaw')

_schema_clients = {}

def get_schema_client(agent_id: str = "global"):
    safe_id = "".join(c for c in agent_id if c.isalnum() or c == '_').lower()
    if not safe_id:
        safe_id = "global"
    graph_name = f"schema_{safe_id}"
    
    if graph_name not in _schema_clients:
        client = OpenClawGraph(graph_name=graph_name)
        client.seed_schema()
        _schema_clients[graph_name] = client
    return _schema_clients[graph_name]
