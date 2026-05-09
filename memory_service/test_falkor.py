from graph_client import OpenClawGraph

client = OpenClawGraph(graph_name="openclaw")
query = "MATCH (f:Fact) RETURN f.subject, f.predicate, f.object, f.source_channel LIMIT 100"
result = client.graph.query(query)
print("Facts in 'openclaw' graph:")
for row in result.result_set:
    print(row)
