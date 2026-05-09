# Base de Conhecimento Técnico - Vento System Errors

## Erro 504: Gateway Timeout na Exportação
**Descrição**: Ocorre quando um usuário tenta exportar relatórios contendo mais de 50.000 linhas ou usando o navegador Safari no macOS.
**Causas Comuns**: 
1. Timeout da query no banco de dados analítico.
2. Interrupção do serviço de background de exportação (Redis Worker).
**Solução/Troubleshooting**:
- Para usuários no macOS, peça para atualizarem o navegador ou utilizarem o Google Chrome.
- Se a tabela tiver mais de 50.000 linhas, oriente o usuário a aplicar filtros de data para particionar a exportação.
- **Solução Definitiva**: Os engenheiros devem aumentar o timeout do Ingress/Nginx para 300 segundos (Ticket INFRA-1022).

## Erro 403: Forbidden - SAML SSO Login
**Descrição**: Usuários Enterprise falham ao tentar fazer login via SSO SAML da Microsoft Azure.
**Causas Comuns**:
1. O certificado X.509 expirou no painel do administrador.
2. Os atributos `NameID` ou `EmailAddress` não estão mapeados corretamente na Azure.
**Solução**:
- Peça ao administrador de TI do cliente para acessar o portal do Vento > Segurança > SSO.
- Solicite que regenerem o certificado XML de Metadados e façam o upload novamente.
- Confirme se o mapeamento `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` está associado à variável `email`.

## Erro 429: Too Many Requests (API V2)
**Descrição**: A API do Vento retorna 429 para integrações rodando scripts Python ou Node.
**Causas Comuns**:
- O usuário do plano Pro atingiu o limite de 100 requisições por minuto.
- O plano Enterprise atingiu 1000 requisições por minuto.
**Solução**:
- Orientar o desenvolvedor a implementar *Exponential Backoff* ou `time.sleep()`.
- Se o usuário precisar de limites maiores (Rate Limit Increase), deve-se abrir um chamado comercial para adquirir o Add-on "High Throughput API" por $50/mês.
