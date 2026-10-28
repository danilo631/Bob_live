# Arquitetura unificada — Bob Live

> **Uma única página para transmissão:** https://bob-live-web-nexttec.onrender.com/
>
> Não há outro jogo publicado na Vercel ou no GitHub Pages. Esses serviços cuidam
> de tarefas distintas. O stream de video do TikTok ainda exige OBS/LIVE Studio
> ou encoder RTMP autorizado funcionando em uma maquina ativa.

## Distribuicao de tarefas

```text
                           [ GitHub Actions ]
                     exporta Godot / CI / Releases
                    Ollama Qwen 0.5B temporario
                                 |
                          (tunnel com chave)
                                 v
[ UNICO SITE ]          [ Render: Node + TikTok ]         [ Vercel ]
 Render Static  <------> ponte WS + auth + fila     ----> /api/brain
 Godot 3D, HTML          Ollama relay (se ativo)         rede neural 49 classes
 Voz Web Speech          Vercel neural (com chave)       CPU sob demanda
 ou Kokoro ONNX          fallback neural local                  |
    |                           ^                               |
    |                           +---------- resposta -------------+
    v
 Janela capturada em OBS/TikTok LIVE Studio
    |
 TikTok RTMP oficial (video nao hospedado nesses servicos)

[ GitHub Pages (opcional) ] -- JSON de conhecimentos, sem jogo nem API
[ GitHub Releases ] ------ bob-live-web.zip e versoes compiladas
```

### Ordem de tratamento de comentarios

1. Render recebe evento do TikTok; fila aplica regras de prioridade.
2. Quando o workflow Ollama Actions esta ativo, Render usa Qwen2.5 0.5B
   por um relay privado e limitado; ao terminar a sessao, o endpoint expira.
3. Na ausencia de Ollama, uma chave de OpenRouter **opcional** permite texto
   generativo. Sem chave, Render chama a rede neural de 49 intencoes da Vercel.
4. Vercel responde via POST privado usando BRAIN_API_KEY; se ela demorar
   mais de 1,8 segundo, Render usa a mesma rede neural local.
5. Se nenhum modelo souber, a fala de reserva do projeto original e usada.
   Mensagens delicadas seguem o tratamento existente, nao sao jogadas num FAQ.
6. Render envia o texto e os eventos por WebSocket para o **mesmo** Godot Web.
7. O navegador sintetiza a voz: modo cartoon Web Speech pt-BR ou Kokoro ONNX
   int8 (voz pm_alex, opcional, processamento do lado cliente).

## Um unico site — onde fica cada parte

- **Render Static:** `https://bob-live-web-nexttec.onrender.com/` (unica interface)
- **Render Web Service:** `https://bob-live-api-nexttec.onrender.com/health`
- **Vercel:** `https://bob-live-nexttec-danilo631s-projects.vercel.app/api/brain`
  (endpoint de inferencia; rota raiz redireciona para o unico site)
- **GitHub Actions:** https://github.com/danilo631/Bob_live/actions
- **GitHub Pages:** se habilitado, publica apenas `/Bob_live/brain/intents.json`;
  a pagina raiz redireciona para o Render.

Vercel usa a chave privada `BRAIN_API_KEY` presente tambem no Render.
Ela nunca aparece no JavaScript publico, GitHub ou na URL. A origem CORS do
Render aceita somente o dominio de interface oficial; o proxy da Vercel usa
autorizacao HTTP servidor-a-servidor.

### Voz tipo desenho animado

- `Cartoon brasileiro`: voz instalada no navegador, pitch 1.48 e ritmo 1.16,
  baixo custo de CPU e inicio rapido.
- `Kokoro 82M neural`: modelo open weight Apache-2.0 com voz **pm_alex**
  brasileira, execucao ONNX/WASM no navegador, pitch e equalizacao cartoon.
  Modelo precisa ser baixado na primeira ativacao; pode consumir mais de 90 MB,
  demorar ou falhar em smartphones. Se falhar, volta automaticamente a Web Speech.
- **Nao** e a voz oficial nem uma clonagem da dublagem do Bob Esponja;
  a proposta e timbre sintetico brasileiro expressivo, sem usar amostras nao
  autorizadas de dubladores. Para clone de voz real, tenha permissao/licenca.

### Limites reais

- Render Free suspende a API depois de 15 minutos sem trafego HTTP ou
  mensagens WebSocket de entrada. Conector TikTok sozinho nao impede isso.
- Vercel Functions tem tempo e cotas por invocacao, nao oferece Ollama daemon.
- GitHub Actions tem duracao maxima por job; o relay manual dura 5–120 min.
- GitHub Pages apenas distribui arquivos estaticos; nao roda Node, Ollama ou TTS.
- Kokoro neural precisa de navegador aberto. Nada disso transmite video 24h
  autonomamente sem encoder e recursos continuos.

## Teste ponta a ponta

1. Abra o site Render; conecte com sua BOB_SESSION_KEY do Render.
2. Use **Perguntar ao Bob** para verificar `/api/brain/ask`; espere o campo
   indicar `vercel-neural` ou `neural-local`.
3. Escolha o modo de voz e clique **Ativar ou testar voz**.
4. Clique **Testar comentario**, depois **Testar presente**.
5. Abra o Dashboard Render e procure no log o aviso
   `IA distribuida: Vercel neural operacional` ou o fallback local.
6. Opcionalmente, ative o workflow Ollama com uma chave BOB_OLLAMA_RELAY_KEY
   compartilhada entre GitHub Actions e Render. O status do site indica o
   motor quando a sessao estiver ativa.
7. Durante uma LIVE TikTok real, verifique a chegada de eventos no Render
   e o audio na captura do OBS/LIVE Studio.

**Referencias de modelos**:
- Kokoro JS: https://github.com/hexgrad/kokoro/tree/main/kokoro.js
- Modelo Kokoro ONNX: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- Ollama Qwen2.5: https://ollama.com/library/qwen2.5
