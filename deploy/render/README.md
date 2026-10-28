# Bob_live no Render + GitHub Actions (sem Oracle)

## Arquitetura escolhida

| Componente | Onde roda | Custo previsto |
|---|---|---|
| Godot 4.7.2 (3D WebGL2), HTML/CSS/JS | **Render Static Site** (CDN) | Gratuito nos limites de banda/build |
| TikTok Live connector, fila de comentários, ranking, API e WebSocket | **Render Free Web Service** (Node) | Gratuito, suspende após 15 min sem HTTP/WS recebido |
| IA de texto | **OpenRouter** via API compatível com OpenAI | Modelos gratuitos têm limites e precisam chave |
| Voz em português | **Web Speech API do próprio navegador** | Sem processamento de voz no servidor; depende do navegador |
| Compilação de Godot WebGL2 | **GitHub Actions** | Runner temporário apenas no build |
| Pacote Web final | **GitHub Release** `web-latest` | Arquivo ZIP publicado com CI |
| Vídeo da live | OBS/TikTok LIVE Studio no PC | Chave/stream autorizados pela plataforma |

**Limite importante:** o plano Free Render NÃO garante uptime 24h. Segundo a Render, após 15 minutos sem uma requisição HTTP ou uma mensagem WebSocket recebida, o serviço dorme. Enquanto o jogo estiver realmente aberto, enviando heartbeats (5 segundos), o serviço tende a permanecer ativo; travamento de navegador, encerramento do PC ou instabilidade reiniciam/interrompem a sessão. Um web service Render pago não dorme, mas não o contrate sem sua aprovação.

**A transmissão de vídeo 24h não está automatizada.** O Render entrega eventos, texto e status; o jogo só desenha e fala quando a página está aberta em um navegador com síntese de voz disponível. A saída de vídeo precisa do OBS, LIVE Studio ou pipeline RTMP autorizado, operando separadamente.

## 1. Verificar o build Web já publicado no GitHub

Abra [GitHub Releases — web-latest](https://github.com/danilo631/Bob_live/releases/tag/web-latest). O workflow [Publicar Bob Live Web](https://github.com/danilo631/Bob_live/actions/workflows/deploy-web.yml) testa e exporta Godot, publica `bob-live-web.zip` nessa Release e não mantém IA rodando.

O Render Static Site baixa apenas esse pacote — não baixa templates Godot de 1,3 GB nem executa Godot na build.

## 2. Criar 2 serviços gratuitos no Render

Acesse [Render Dashboard](https://dashboard.render.com/). Para criar os dois serviços com os parâmetros já no repositório, escolha **New → Blueprint → GitHub → danilo631/Bob_live** e selecione **render.yaml**.

Alternativamente, crie serviços manualmente:

**Render Web Service (API):**
- Nome exato `bob-live-api-nexttec`
- GitHub `https://github.com/danilo631/Bob_live`, branch `main`, runtime `Node`, plano **Free**
- Build Command: `bash deploy/render/build-backend.sh`
- Start Command: `node deploy/render/server.js`
- Health Check Path: `/health`
- Variáveis de ambiente: `TIKTOK_USERNAME=nexttec_1`, `BOB_PUBLIC_ORIGIN=https://bob-live-web-nexttec.onrender.com`, `AI_PROVIDER=openai`, `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, `OPENAI_MODEL=openrouter/free`.
- **Secret obrigatório:** `BOB_SESSION_KEY`, senha aleatória com pelo menos 20 caracteres. **Anote-a** para usar no navegador. Nunca publique nem emite esta senha em logs.
- **Secret para IA real:** `OPENAI_API_KEY`, sua chave OpenRouter (não compartilhar no repositório). Sem chave, a IA via OpenRouter não funciona; as falas de reserva do projeto original podem funcionar, dependendo do evento.
- **Não** instale Ollama/Piper no plano Free: ambos excedem ou pressionam a memória junto com Node.

**Render Static Site:**
- Nome exato `bob-live-web-nexttec`
- Mesmo repositório e branch
- Build Command: `bash deploy/render/build-frontend.sh`
- Publish Directory: `site`
- Deploy automático: preferencialmente **After CI Checks Pass**, para o ZIP não ser baixado antes de a Release ser atualizada.
- URL esperada: `https://bob-live-web-nexttec.onrender.com/`

Se os nomes da URL renderizada forem alterados por colisões ou renomeação, ajuste `BOB_PUBLIC_ORIGIN` no backend e a URL permitida em `site/main.js`, então recompile e publique. A origem é restrita intencionalmente por segurança.

### Onde configurar sua chave OpenRouter

Acesse https://openrouter.ai/settings/keys e crie uma chave. Cole-a apenas em **Render Web Service → Environment → OPENAI_API_KEY**. Os modelos gratuitos atuais e os limites estão em https://openrouter.ai/collections/free-models. O roteamento automático `openrouter/free` seleciona um modelo gratuito disponível, mas não garante resposta, limite, privacidade ou gratuidade sem restrições.

## 3. Usar o personagem na página

1. Abra `https://bob-live-web-nexttec.onrender.com/`.
2. O endereço da API `https://bob-live-api-nexttec.onrender.com/` deve ser preenchido automaticamente.
3. Digite sua `BOB_SESSION_KEY` configurada no serviço Render.
4. Clique **Conectar IA + Voz + TikTok**.
5. Clique **Ativar voz brasileira do navegador** e depois dentro do jogo 3D para liberar áudio.
6. Use **Testar comentário** e **Testar presente** antes de transmitir.
7. Inicie uma live autorizada pelo TikTok, capture a janela do navegador e **áudio do sistema** no OBS/LIVE Studio.

A voz usa a voz pt-BR instalada no navegador/sistema e eleva pitch levemente. **Não é a voz oficial do Bob Esponja, nem uma clonagem**. Sem voz pt-BR instalada, o sintetizador do navegador usa a alternativa disponível e a qualidade varia. A sincronização de boca no modo gratuito é aproximada; ela acompanha o período da fala e não os fonemas.

O monitor TikTok é não oficial e depende de haver uma live ativa de `nexttec_1`. O IP do Render pode sofrer bloqueio pelo TikTok. Não é possível garantir resposta a todos os comentários/presentes.

## 4. Saúde e diagnóstico

- Health público do backend: `https://bob-live-api-nexttec.onrender.com/health` — verifica somente o proxy, não confirma IA ou TikTok.
- O botão de conexão verifica `/api/status` autenticado e mostra IA, monitor TikTok e conexão Godot.
- Logs e eventos: **Render Dashboard → bob-live-api-nexttec → Logs/Events**.
- Build do Godot: **GitHub Actions → Publicar Bob Live Web (Godot)**.
- Testes backend: **GitHub Actions → Validar backend Render leve**.
- O servidor pode acordar lentamente ao primeiro acesso depois do período inativo.

Para solicitar deploy do site somente depois do build, é possível cadastrar em GitHub Actions Secrets o `RENDER_STATIC_DEPLOY_HOOK` obtido na configuração de deploy do site Render. O workflow chama esse hook após publicar o ZIP; **não use o hook do backend para isso**.

## O que está testado e o que falta

- O GitHub Actions valida a segurança do proxy, prepara o Node e a voz no Godot, exporta HTML5/WASM e empacota o site na Release.
- O pacote público pode ser implantado no Render como Static Site.
- **Ainda precisa criar os serviços, salvar os dois segredos e confirmar runtime com o TikTok e navegador reais.** Sem isso, não há backend no ar nem garantia de live funcionando.
- Gratuidade 24/7 e vídeo 24/7 garantidos não são possíveis usando somente Render Free + GitHub Actions.
- Respeite as licenças originais em `upstream/LICENSE` e `upstream/NOTICE.md` e os termos do TikTok e do provedor de IA.
