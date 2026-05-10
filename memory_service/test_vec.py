from falkordb import FalkorDB
import numpy as np

db = FalkorDB(host='localhost', port=6380)
graph = db.select_graph('openclaw')

try:
    graph.query("CREATE VECTOR INDEX FOR (f:Fact) ON (f.embedding) OPTIONS {dimension: 3072, similarityFunction: 'cosine'}")
except Exception as e:
    print(f"Index creation: {e}")

try:
    res = graph.query("CALL db.idx.vector.queryNodes('Fact', 'embedding', 3, vecf32([0.1]*3072)) YIELD node, score RETURN node, score")
    print(res.result_set)
except Exception as e:
    print(f"Query Nodes error: {e}")

try:
    # Let's try vec.distance if there's a different function name
    pass
except Exception as e:
    pass

