import asyncio
from graph_client import OpenClawGraph

async def main():
    graph_obj = OpenClawGraph(graph_name="schema_support")
    res = await asyncio.to_thread(graph_obj.graph.query, "MATCH (i:Interaction) RETURN count(i)")
    for record in res.result_set:
        print(f"Interactions count: {record[0]}")
    res2 = await asyncio.to_thread(graph_obj.graph.query, "MATCH (u:Entity)-[:ENGAGED_IN]->(i:Interaction) RETURN u.name, i LIMIT 2")
    for record in res2.result_set:
        user_name = record[0]
        i_props = record[1].properties
        print(f"User: {user_name}, Interaction: {i_props}")

asyncio.run(main())
