# Bob Live — Vercel + Render + Actions + Ollama temporario

## O que roda em cada servico

- **GitHub Actions** compila o Godot Web e publica `web-latest/bob-live-web.zip`. Pode rodar o Ollama `qwen2.5:0.5b` por tempo **limitado** sob demanda (5–120 minutos).
- **Vercel** hospeda a mesma pagina Godot e oferece `/api/brain` (rede neural 256→24→49, CPU leve).
- **Render Free** mantem Node, TikTok Live Connector, ranking, WebSocket/controle e a rede neural local de reserva, sem Ollama instalado na memoria do Render.
- **OpenRouter** (opcional, mediante chave pessoal) permite gerar respostas nao previstas na lista, mesmo com o runner de Ollama desligado.
- **Web Speech API** gera voz pt-BR na maquina que abre o navegador. O servidor nao envia audio processado por Piper no modo leve.

**Atencao:** O Render Free suspende serviços por inatividade; o Ollama num runner GitHub não e hospedagem permanente. Vercel Functions executam por requisicao e nao servem como processo Ollama 24 horas. O jogo tambem nao e uma transmissao de video ao TikTok por si so.

## 1. Vercel (conexao necessaria)

Conecte a app Vercel ao ChatGPT ou acesse https://vercel.com/new e importe `https://github.com/danilo631/Bob_live`.

Nome do projeto: `bob-live-nexttec` (gerara o endereco previsto `https://bob-live-nexttec.vercel.app` caso esteja disponivel).

A raiz contem [vercel.json](../../vercel.json), que utiliza o build `bash deploy/render/build-frontend.sh` para buscar o ZIP da Release e publica `site/`. A funcao `api/brain.js` usa `brain/index.js` com dados de `brain/intents.json`.

Em **Vercel → Project Settings → Environment Variables**, crie:
- `BRAIN_API_KEY`: segredo privado aleatorio com **32+ caracteres** (igual no Render, para a comunicacao entre servidores).

Depois configure no servico Render (https://dashboard.render.com/web/srv-dbh2iejl550s73c192h0) os mesmos valores:
- `BRAIN_API_KEY=<o mesmo valor da Vercel>`
- `BRAIN_REMOTE_URL=https://bob-live-nexttec.vercel.app/api/brain`
- `BOB_PUBLIC_ORIGINS=https://bob-live-web-nexttec.onrender.com,https://bob-live-nexttec.vercel.app`

A rede neural funciona localmente no Render **sem** essas variaveis; a Vercel e o offload opcional por ate 1,8 segundo antes de retornar ao classificador local.

**Nao exponha** `BRAIN_API_KEY` no `vercel.json`, JavaScript do navegador, issues ou logs. `GET /api/brain` permite ver apenas estatisticas; `POST` exige chave privada.

## 2. Ollama no GitHub Actions — quando quiser respostas generativas locais

Existe o workflow [Ollama Qwen 0.5B temporario — Render](../../.github/workflows/ollama-relay.yml).

Para ativa-lo, gere um **outro segredo** privado aleatorio com pelo menos 32 caracteres e coloque o mesmo valor em:

1. Render Web Service `bob-live-api-nexttec` → Environment → `BOB_OLLAMA_RELAY_KEY`.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret → `BOB_OLLAMA_RELAY_KEY`.

Execute manualmente no Actions e selecione `minutos`. O runner baixa o Ollama e o Qwen2.5 0.5B, cria uma ponte que aceita somente POST `/v1/chat/completions` com Bearer secreto, abre um Cloudflare Quick Tunnel HTTPS e registra o endpoint no Render.

O backend Render valida o registro e guarda a URL apenas no disco temporario, com expiracao maxima de duas horas. Enquanto a sessao existir, usa o Ollama como modelo generativo; ao fim, volta a IA remota configurada ou ao classificador neural. Nao divulgue a URL temporaria nem o segredo do relay.

O workflow e **manual** e termina apos o periodo selecionado; nao cria ciclos infinitos de Actions e nao garante uma live 24h. Para Ollama permanente, e preciso uma maquina ou plano com RAM suficiente e processo sem suspensao.

## 3. Cerebro neural local e perguntas

[brain/intents.json](../../brain/intents.json) possui 49 categorias, 251 perguntas de treinamento e 147 respostas predefinidas em portugues. O classificador usa vetores hash e uma rede neural pequena com camada oculta de 24 neuronios; trata entradas conhecidas, rejeita perguntas desconhecidas e **nao** inventa respostas generativas. Temas delicados nao sao respondidos por esse classificador.

O mesmo arquivo e reutilizado por Vercel e Render; testes: `node scripts/test_brain.js`.

Ordem de operacao na resposta de comentarios:
1. Se houver Ollama temporario ativo, tentar resposta generativa nele.
2. Sem Ollama, usar OpenRouter caso esteja configurado com `OPENAI_API_KEY`.
3. Sem API configurada ou em falha, usar a rede neural: Vercel se conectada e, em seguida, Render local.
4. Se nao houver classe conhecida, usar mensagens de reserva do projeto original. Mensagens delicadas usam as rotinas de seguranca existentes, nao respostas curtas por classificacao.

## 4. Testes

- [GitHub Actions — Validar backend Render leve](../../.github/workflows/test-render.yml) testa a rede neural e proxy Ollama sem baixar modelos no CI.
- [GitHub Actions — Publicar Bob Live Web](../../.github/workflows/deploy-web.yml) compila Godot.
- A pagina de teste do Render: https://bob-live-web-nexttec.onrender.com/
- O backend de teste: https://bob-live-api-nexttec.onrender.com/health

**Limites:** GitHub Actions nao oferece um host 24h por job; Vercel Functions nao executam servicos permanentes; Render Free dorme sem trafego. A captura e publicacao de video para TikTok ainda dependem de um encoder/RTMP autorizado e ativo.
