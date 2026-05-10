import os
import sys
import json
import asyncio
import discord

# Importa o gerenciador de agentes do Vento
from adk_agents import get_agent, load_agents_config

def start_discord_agent(agent_id: str):
    """
    Inicia o bot do Discord para um agente específico, utilizando o token salvo no Vento.
    """
    # 1. Lê a configuração gerada pelo Vento UI (agents_config.json)
    config = load_agents_config()
    
    if agent_id not in config:
        print(f"Erro: Agente '{agent_id}' não encontrado no Vento.")
        sys.exit(1)
        
    agent_info = config[agent_id]
    
    # 2. Busca o token do Discord que você configurou na UI
    channels = agent_info.get("channels", {})
    discord_config = channels.get("discord", {})
    
    if not discord_config.get("enabled"):
        print(f"Erro: O canal do Discord não está habilitado para o agente '{agent_id}'. Habilite na UI do Vento.")
        sys.exit(1)
        
    bot_token = discord_config.get("token") or discord_config.get("bot_token")
    if not bot_token:
        print(f"Erro: Bot Token do Discord não configurado para o agente '{agent_id}'.")
        sys.exit(1)
        
    # 3. Inicializa o motor OpenClaw carregado com as ferramentas do Vento
    print(f"Inicializando motor OpenClaw para o agente '{agent_id}'...")
    agent = get_agent(agent_id)
    print("OpenClaw inicializado com sucesso!")
    
    # 4. Configura o cliente do Discord
    intents = discord.Intents.default()
    intents.message_content = True  # Necessário para ler o conteúdo das mensagens
    client = discord.Client(intents=intents)
    
    @client.event
    async def on_ready():
        print(f"Bot conectado ao Discord como {client.user}")
        print(f"Agente Vento '{agent_info['name']}' pronto para operar!")
        
    @client.event
    async def on_message(message):
        print(f"DEBUG - Mensagem recebida: '{message.content}' de {message.author}. Mentions: {[u.name for u in message.mentions]}")
        
        # Ignora mensagens do próprio bot
        if message.author == client.user:
            return
            
        # Responde se o bot for mencionado (diretamente ou via cargo/role) ou se for uma DM
        is_mentioned = client.user.mentioned_in(message)
        is_dm = isinstance(message.channel, discord.DMChannel)
        
        if is_mentioned or is_dm:
            print(f"Processando mensagem de {message.author}...")
            
            # Avisa o usuário que está processando (digitação)
            async with message.channel.typing():
                try:
                    # Usa clean_content (que converte IDs em nomes como @vento-dev) e remove o nome do bot
                    user_text = message.clean_content
                    # Remove o nome do bot do começo da mensagem se houver
                    bot_mention_text = f"@{client.user.name}"
                    user_text = user_text.replace(bot_mention_text, "").strip()
                    
                    # 5. O PONTO CHAVE: Passa a mensagem para o OpenClaw (que pode usar o FalkorDB)
                    # Como agent.run não existe mais, usamos o Runner do ADK
                    from google.adk import Runner
                    from google.adk.sessions import InMemorySessionService
                    from google.genai import types
                    
                    if not hasattr(client, "session_service"):
                        client.session_service = InMemorySessionService()
                        
                    runner = Runner(agent=agent, app_name="vento", session_service=client.session_service)
                    session_id = f"discord_channel_{message.channel.id}"
                    
                    msg = types.Content(role="user", parts=[types.Part.from_text(text=user_text)])
                    response_text = ""
                    
                    async for event in runner.run_async(user_id=str(message.author.id), session_id=session_id, new_message=msg):
                        if hasattr(event, "content") and event.content is not None:
                            if hasattr(event.content, "parts"):
                                for part in event.content.parts:
                                    if part.text: response_text += part.text
                            elif hasattr(event.content, "text") and event.content.text:
                                response_text += event.content.text
                        elif hasattr(event, "text") and event.text:
                            response_text += event.text
                    
                    if not response_text:
                        response_text = "Desculpe, não consegui gerar uma resposta."
                    
                    # Envia a resposta final (depois que o LLM usou as ferramentas e gerou o texto)
                    await message.channel.send(response_text)
                except Exception as e:
                    print(f"Erro ao processar mensagem: {e}")
                    await message.channel.send("Desculpe, ocorreu um erro ao acessar meus bancos de dados. Tente novamente.")
                    
    # 6. Roda o bot
    print("Conectando aos servidores do Discord...")
    try:
        client.run(bot_token)
    except Exception as e:
        print(f"Erro de conexão com Discord (Token inválido?): {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python run_discord_agent.py <agent_id>")
        print("Exemplo: python run_discord_agent.py support")
        sys.exit(1)
        
    start_discord_agent(sys.argv[1])
