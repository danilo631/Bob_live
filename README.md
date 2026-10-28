# Bob Live — página web + IA e voz no GitHub Actions

Adaptação do [Live Fenda do Biquíni de Luis Felipe / LSzerodev](https://github.com/LSzerodev/bob-live) para **@nexttec_1**. O código original é preservado como submódulo em `upstream/`.

**Página:** https://danilo631.github.io/Bob_live/  
**Workflow de sessões:** https://github.com/danilo631/Bob_live/actions/workflows/bob-live.yml  
**Workflow de publicação:** https://github.com/danilo631/Bob_live/actions/workflows/deploy-web.yml

## Tudo na nuvem, sem instalar IA no PC

O Google/Chrome/Edge no seu computador apenas desenha e toca o jogo; o GitHub Actions é a máquina temporária que roda a IA e a voz.

| Camada | Onde roda | Tecnologia |
|---|---|---|
| Personagem e cenário | Navegador, pelo GitHub Pages | Godot 4.7.2 HTML5/WebGL 2 |
| Resposta de IA | Runner gratuito do GitHub Actions (CPU) | Ollama + Qwen2.5 0.5B (ou 1.5B) |
| Voz brasileira | Runner do Actions (CPU) | Piper pt_BR-faber-medium, pitch caricato opcional |
| Comentários e presentes | Runner do Actions | tiktok-live-connector, usuário @nexttec_1 |
| WebSocket/voz ao navegador | Runner + Cloudflare Quick Tunnel | HTTPS/WSS temporários, autenticados por senha |
| Transmissão do vídeo ao TikTok | Seu PC, captura da aba Web | OBS ou TikTok LIVE Studio |

**Não precisa instalar Ollama, Python, Node ou Godot no seu PC.** Mas precisa abrir a página no mesmo PC que fará a transmissão, capturar a janela e áudio com OBS/TikTok LIVE Studio. O GitHub não inicia uma transmissão por conta própria.

## Configuração obrigatória, uma só vez

**1. Habilitar o GitHub Pages.**

Abra [Settings → Pages](https://github.com/danilo631/Bob_live/settings/pages), escolha **Source → GitHub Actions** e salve. A API do GitHub não permitiu habilitar Pages automaticamente. Depois execute [Publicar Bob Live Web (Godot)](https://github.com/danilo631/Bob_live/actions/workflows/deploy-web.yml) com **Run workflow**. O build também gera um artefato `bob-live-web`, mas ele não substitui a publicação em Pages.

**2. Criar uma senha de sessão.**

Abra [Settings → Secrets and variables → Actions](https://github.com/danilo631/Bob_live/settings/secrets/actions). Em **New repository secret**, configure:

- **Name:** `BOB_SESSION_KEY`
- **Secret:** uma senha aleatória forte com **20 a 256 caracteres** (use um gerador de senhas). Anote para digitá-la na página.

Nunca coloque a senha no README, código, issues ou logs. O túnel oferece apenas as rotas permitidas `/ws/godot`, `/api/status`, `/api/simulate/chat` e `/api/simulate/gift`. Configurações, voz, cookies e painel completo não ficam expostos.

## Iniciar a sessão

1. Abra [Actions → Bob Live - IA e voz locais](https://github.com/danilo631/Bob_live/actions/workflows/bob-live.yml).
2. Clique em **Run workflow** e selecione **modo: web-live**, **usuario: nexttec_1**, **modelo: qwen2.5:0.5b** e duração (1–330 min).
3. Entre no job **Ollama + Piper + eventos do TikTok**, etapa **Sessao web**. Copie a URL temporária `https://xxxxxxxx.trycloudflare.com` mostrada no log. **Não compartilhe sua senha.**
4. Abra a [página Bob Live](https://danilo631.github.io/Bob_live/), cole a URL e a mesma senha do GitHub Secret. Clique em **Conectar IA + Voz + TikTok**.
5. O personagem deve abrir em 3D. Clique dentro do jogo para liberar áudio no navegador; use **Testar comentário** e **Testar presente** antes de fazer a live.
6. Inicie sua live TikTok de forma autorizada e capture a janela do navegador + áudio com OBS/TikTok LIVE Studio (vídeo **9:16**).

**Importante:** para ouvir comentários reais, a live de @nexttec_1 deve existir e o conector não oficial TikTok deve conseguir acessar o TikTok a partir do IP do GitHub. Mesmo com o monitor offline, o simulador pode testar IA/voz.

## Limitações reais do gratuito

- O **GitHub Actions não é um servidor permanente**: um job do runner hospedado tem limite de **6 horas**; sessões são limitadas aqui a 330 minutos, e podem terminar antes por falhas de rede ou cota. Uma nova sessão gera outra URL.
- **Cloudflare Quick Tunnel** é gratuito para testes, mas **não tem garantia de disponibilidade**; a URL muda a cada sessão. Não serve como infraestrutura 24/7 confiável.
- O runner não possui GPU dedicada: a IA `qwen2.5:0.5b` é mais rápida, porém menos inteligente. `qwen2.5:1.5b` é alternativa com maior qualidade e latência.
- A voz Piper no Actions usa **um tom caricato em pt-BR**; ela **não é a voz oficial nem uma clonagem da voz do Bob Esponja**.
- O GitHub Pages é estático: não hospeda modelos ou conexão TikTok continuamente, apenas os arquivos HTML/WASM do Godot.
- O conector `tiktok-live-connector` é não oficial; o IP do runner pode ser rejeitado.
- Este projeto não acessa ou cria chave de stream do TikTok e não transmite vídeo ao vivo diretamente do runner.
- O site precisa de WebGL 2.0; áudio requer interação (clique) no navegador.

## Código e créditos

- `upstream/` — fonte original mantida por submódulo.
- `scripts/prepare_web.py` — cópia temporária de Godot/Node; adiciona carregamento de WAV sobre WSS e leitura de URL do navegador; não altera o código original.
- `scripts/public_bridge.js` — proxy limitado e autenticado para web.
- `scripts/piper_server.py` — serviço de síntese de voz em CPU no runner.
- `scripts/test_public_bridge.js` e `scripts/test_web_adapter.py` — testes.
- `site/` — interface de captura e conexão do navegador.
- `.github/workflows/bob-live.yml` — inicia sessões; `.github/workflows/deploy-web.yml` — publica jogo Web.

Projeto original de **Luis Felipe / LSzerodev**. Mantenha os créditos e consulte [LICENSE](upstream/LICENSE), [NOTICE.md](upstream/NOTICE.md) e a [comunidade](https://t.me/+dodaVsUWVoQ0Yjhh). Personagem, modelo 3D, fundos e marcas são de terceiros; verifique autorizações para transmissões e uso comercial.
