import requests

MEMORY_SERVICE_URL = "http://localhost:8000"

class OpenClawMemoryHook:
    def __init__(self, user_id: str, channel: str):
        self.user_id = user_id
        self.channel = channel
        self.local_context = []

    def receive_message(self, message: str):
        """Simulates receiving a message from the user on a specific channel."""
        print(f"[{self.channel}] User: {message}")
        
        # 1. Background task: Ingest message into memory service
        self._async_ingest(message)
        
        # 2. Append to local context
        self.local_context.append({"role": "user", "content": message})
        
        # 3. Retrieve relevant global context before generating LLM response
        global_facts = self._retrieve_context(message)
        
        # 4. Generate response (Mocking LLM call)
        self._generate_response(global_facts)

    def _async_ingest(self, message: str):
        try:
            res = requests.post(
                f"{MEMORY_SERVICE_URL}/ingest", 
                json={"user_id": self.user_id, "channel": self.channel, "message": message}
            )
            # In a real async hook, we wouldn't block for this
        except requests.exceptions.ConnectionError:
            print("[System] Memory service unavailable for ingest.")

    def _retrieve_context(self, current_query: str) -> list[str]:
        try:
            res = requests.post(
                f"{MEMORY_SERVICE_URL}/retrieve",
                json={"user_id": self.user_id, "query": current_query}
            )
            if res.status_code == 200:
                return res.json().get("relevant_facts", [])
        except requests.exceptions.ConnectionError:
            print("[System] Memory service unavailable for retrieve.")
        return []

    def _generate_response(self, global_facts: list[str]):
        """Mocks the LLM response generation incorporating global facts."""
        
        # In a real scenario, global_facts would be injected as a System Prompt
        system_prompt = "You are OpenClaw Assistant."
        if global_facts:
            system_prompt += " Here are relevant facts about the user:\n" + "\n".join(f"- {f}" for f in global_facts)
            
        print(f"[{self.channel}] System Context injected: {global_facts}")
        
        # Mocking an LLM seeing the context
        if "favorite color" in self.local_context[-1]['content'].lower() and "what is" in self.local_context[-1]['content'].lower():
            # Check if we have it in facts
            color_fact = next((f for f in global_facts if "FAVORITE_COLOR" in f), None)
            if color_fact:
                color = color_fact.split()[-1]
                response = f"Your favorite color is {color}."
            else:
                response = "I don't know your favorite color yet."
        elif "meeting" in self.local_context[-1]['content'].lower() and "when" in self.local_context[-1]['content'].lower():
            meeting_fact = next((f for f in global_facts if "HAS_MEETING" in f), None)
            if meeting_fact:
                time = meeting_fact.split()[-1]
                response = f"Your meeting is on {time}."
            else:
                response = "I don't have a record of that meeting."
        else:
            response = "Acknowledged."
            
        print(f"[{self.channel}] Assistant: {response}\n")
        self.local_context.append({"role": "assistant", "content": response})

if __name__ == "__main__":
    # Simulate cross-channel interaction
    whatsapp_session = OpenClawMemoryHook(user_id="user123", channel="WhatsApp")
    slack_session = OpenClawMemoryHook(user_id="user123", channel="Slack")
    
    print("--- DEMO START ---\n")
    
    # User shares a fact on WhatsApp
    whatsapp_session.receive_message("My meeting with Acme Corp was moved to Thursday")
    
    # User shares some noise on WhatsApp (Should not pollute)
    whatsapp_session.receive_message("lol that's crazy")
    
    import time
    time.sleep(1) # wait for async ingest
    
    # User asks about the fact on Slack (Different session, isolated context)
    slack_session.receive_message("When is my meeting with Acme Corp?")
    
    # User updates a fact on Slack (Conflict resolution test)
    slack_session.receive_message("Actually my favorite color is blue")
    
    time.sleep(1)
    
    # User updates it again
    whatsapp_session.receive_message("Wait, my favorite color is green")
    
    time.sleep(1)
    
    slack_session.receive_message("What is my favorite color?")
