import json
import os

class OntologyManager:
    def __init__(self):
        self.schemas = {}

    def _get_schema_file(self, agent_id: str) -> str:
        safe_id = "".join(c for c in agent_id if c.isalnum() or c == '_').lower()
        if not safe_id:
            safe_id = "global"
        return f"{safe_id}_ontology_schema.json"

    def get_schema(self, agent_id: str = "global"):
        if agent_id not in self.schemas:
            schema_file = self._get_schema_file(agent_id)
            if os.path.exists(schema_file):
                with open(schema_file, "r") as f:
                    self.schemas[agent_id] = json.load(f)
            else:
                # Default schema if none exists
                default_schema = {
                    "nodes": ["User", "Fact", "Entity"],
                    "predicates": [
                        "HAS_MEETING_WITH",
                        "FAVORITE_COLOR",
                        "WORKS_AT",
                        "LIKES",
                        "KNOWS"
                    ],
                    "properties": {
                        "Fact": ["subject", "predicate", "object", "timestamp", "source_channel", "status", "embedding"]
                    }
                }
                self.save_schema(default_schema, agent_id)
                self.schemas[agent_id] = default_schema
        return self.schemas[agent_id]

    def save_schema(self, schema_data, agent_id: str = "global"):
        self.schemas[agent_id] = schema_data
        schema_file = self._get_schema_file(agent_id)
        with open(schema_file, "w") as f:
            json.dump(self.schemas[agent_id], f, indent=4)

    def validate_triple(self, subject: str, predicate: str, object_val: str, agent_id: str = "global") -> bool:
        """Validates if a predicate is allowed in the ontology for a specific agent."""
        # Simple validation for the challenge
        if predicate.startswith("HAS_MEETING_WITH_"):
            return True
            
        schema = self.get_schema(agent_id)
        return predicate in schema.get("predicates", [])
        
    def list_schemas(self) -> list:
        """List all available schemas by finding *_ontology_schema.json files."""
        schemas = []
        for filename in os.listdir('.'):
            if filename.endswith("_ontology_schema.json"):
                agent_id = filename.replace("_ontology_schema.json", "")
                schemas.append(agent_id)
        # Ensure at least 'global' is present
        if "global" not in schemas:
            schemas.append("global")
        return list(set(schemas))

ontology_manager = OntologyManager()
