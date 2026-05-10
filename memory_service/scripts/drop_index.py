import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from falkordb import FalkorDB

db = FalkorDB(host='localhost', port=6380)
graph = db.select_graph('openclaw')

try:
    graph.query("DROP INDEX ON :Fact(embedding)")
    print("Dropped index")
except Exception as e:
    print(f"Error dropping index: {e}")

