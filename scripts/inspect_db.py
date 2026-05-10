from falkordb import FalkorDB
db = FalkorDB(host='localhost', port=6380)
graph = db.select_graph('openclaw')
res = graph.query("MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 1")
if res.result_set:
    n, r, m = res.result_set[0]
    print("Node:", type(n), dir(n))
    print("Edge:", type(r), dir(r))
    print("Node props:", getattr(n, 'properties', None), getattr(n, 'alias', None), getattr(n, 'labels', None))
    print("Edge src dest type:", getattr(r, 'src_node', None), getattr(r, 'dest_node', None), getattr(r, 'relation', None))
