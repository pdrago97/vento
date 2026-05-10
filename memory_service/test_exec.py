def bind_base_tool(agent_id: str, func_name: str, func_ref):
    func_code = f"""
def {func_name}(x):
    return func_ref(agent_id, x)
"""
    exec_globals = globals().copy()
    exec_globals['func_ref'] = func_ref
    exec_globals['agent_id'] = agent_id
    exec(func_code, exec_globals)
    return exec_globals[func_name]

def real_tool(agent_id, x):
    return f"real_tool {agent_id} {x}"

def real_tool_2(agent_id, x):
    return f"real_tool_2 {agent_id} {x}"

f1 = bind_base_tool("test1", "f1", real_tool)
f2 = bind_base_tool("test2", "f2", real_tool_2)

print(f1(10))
print(f2(20))
