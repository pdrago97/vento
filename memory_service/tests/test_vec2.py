import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from falkordb import FalkorDB
import numpy as np

db = FalkorDB(host='localhost', port=6380)
graph = db.select_graph('openclaw')

try:
    # Try different index creation syntax
    graph.query("CREATE INDEX FOR (f:Fact) ON (f.embedding) OPTIONS {type: 'VECTOR', dimension: 768, metric: 'COSINE'}")
except Exception as e:
    print(f"Index creation 2: {e}")

try:
    # Use parameters
    emb = [0.1] * 3072
    res = graph.query("CALL db.idx.vector.queryNodes('Fact', 'embedding', 3, vecf32($emb)) YIELD node, score RETURN node, score", {'emb': emb})
    print(res.result_set)
except Exception as e:
    print(f"Query Nodes error 2: {e}")

try:
    res = graph.query("MATCH (f:Fact) RETURN f, vec.distance(f.embedding, vecf32($emb)) AS dist", {'emb': emb})
    print(res.result_set)
except Exception as e:
    print(f"Cosine distance error: {e}")

