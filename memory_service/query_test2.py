import asyncio
from graph_client import OpenClawGraph

async def main():
    graph_obj = OpenClawGraph(graph_name="schema_support")
    res = await asyncio.to_thread(graph_obj.graph.query, "MATCH (u:Entity)-[:ENGAGED_IN]->(i:Interaction) RETURN u.name, i LIMIT 2")
    for record in res.result_set:
        print(f"User: {record[0]}, Interaction properties: {record[1].properties}")

asyncio.run(main())
