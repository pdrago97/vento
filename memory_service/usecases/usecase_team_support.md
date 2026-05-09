# Histórico de Comunicação Interna (Transcripts)

## Canal Slack: #engineering-backend
**Data:** 14 de Abril de 2026

**[10:15 AM] @carlos_techlead:**
> Galera, o novo processo de deploy em produção mudou a partir de hoje. Ao invés de mergear direto na `main`, vocês precisam abrir PR para a branch `staging`. O CI vai rodar os testes end-to-end automáticos lá.
> Se a build passar no Jenkins (job: `Vento-E2E-Staging`), então vocês devem usar o comando `/deploy-prod` aqui no Slack para jogar para produção.

**[10:18 AM] @junior_dev:**
> Mas o que acontece se os testes e2e falharem na branch `staging`?

**[10:20 AM] @carlos_techlead:**
> O PR será automaticamente bloqueado. Você terá que checar os logs do Jenkins, corrigir o erro na sua branch local, dar um push novamente para atualizar o PR. Nunca façam bypass dessa validação, caso contrário quebraremos o ambiente de QA.

**[10:25 AM] @ana_qa:**
> Confirmando: o job do Jenkins demora uns 15 minutos para rodar a suite completa. Por favor, revisem bem os testes unitários localmente (`make test-unit`) antes de abrir o PR para não engarrafar o Jenkins.

---

## Conversa WhatsApp: Suporte Nível 2
**Data:** 15 de Abril de 2026

**[09:00 AM] Atendente Lucas:**
> Pessoal, estou com o cliente Acme Corp na linha. Eles não conseguem acessar o portal de faturamento. Erro 500 no dashboard de billing. Algum incidente rolando?

**[09:03 AM] Engenheiro DevOps (Marcos):**
> Sim, Lucas. O provedor do banco de dados financeiro (AWS RDS) está passando por uma manutenção não programada na região `us-east-1`. Já postamos no status page. 

**[09:05 AM] Atendente Lucas:**
> Qual é o SLA de resolução que posso passar para eles? 

**[09:07 AM] Engenheiro DevOps (Marcos):**
> A AWS informou que deve voltar em 45 minutos. Avise que não há perda de dados, é apenas uma janela de indisponibilidade de leitura. As faturas automáticas de hoje já foram processadas de madrugada.

**[09:10 AM] Gerente de Suporte (Helena):**
> Lucas, crie um ticket no Zendesk taggeado como `Incidente_RDS_Abril`, coloque no status "Pendente" e envie o template de "Indisponibilidade Temporária Nível 1" para a Acme Corp. Quando voltar, avisaremos todo mundo para fechar os tickets.
