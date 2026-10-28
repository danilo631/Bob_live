# Bob_live — Godot Web + Render + GitHub Actions

Projeto adaptado de [LSzerodev/bob-live](https://github.com/LSzerodev/bob-live), por Luis Felipe, para lives TikTok de **@nexttec_1**.

## Versão híbrida: Vercel + Render + GitHub Actions

**[Guia das três plataformas](deploy/vercel/README.md)** · **[Render](deploy/render/README.md)** · **[Workflow Godot Web](.github/workflows/deploy-web.yml)** · **[Testes backend Render](.github/workflows/test-render.yml)** · **[Pacote Web gerado (Release)](https://github.com/danilo631/Bob_live/releases/tag/web-latest)**

- **GitHub Actions** compila e testa o Godot 4.7.2, produz `bob-live-web.zip` e disponibiliza uma Release pública.
- **Vercel (opcional, aguardando conexão)** hospeda outra cópia da interface e uma função neural que classifica perguntas, com autenticação privada para o Render.
- **Ollama no Actions (sob demanda, não 24h):** o Qwen2.5 0.5B pode responder ao Render pelo relay protegido durante uma sessão manual limitada, com fallback neural após expirar.
- **Render Static Site** baixa apenas o ZIP pronto e hospeda o jogo 3D WebGL2 com CDN.
- **Render Free Web Service** executa o Node.js, conector TikTok, filas de chat/presentes e API/WebSocket autenticados.
- **Nova rede neural de intenções** classifica 49 assuntos, treinada com 251 frases em português e 147 respostas predefinidas; funciona sem API. **OpenRouter** (opcional com chave pessoal) responde a assuntos abertos quando não há Ollama ativo.
- **Web Speech API do navegador** fala pt-BR e aproxima o movimento da boca sem Ollama/Piper consumindo RAM do Render.
- **OBS/TikTok LIVE Studio** captura o navegador e áudio para uma live autorizada.

**Atenção sobre 24h:** o Render Free pode suspender serviços depois de 15 minutos sem tráfego real de entrada, e o Actions também não é um servidor permanente. O monitor permanece ativo enquanto o backend está acordado; o site estático pode permanecer acessível enquanto a plataforma estiver disponível, mas isso não garante a continuidade da IA/TikTok ou de uma transmissão de vídeo 24 horas. Consulte o [guia Render](deploy/render/README.md) para requisitos e testes reais.

Endpoints previstos após implantação:
- `https://bob-live-web-nexttec.onrender.com/` — site e personagem 3D.
- `https://bob-live-api-nexttec.onrender.com/health` — status público mínimo da API, não é teste de IA.

**Render já provisionado:** o site `bob-live-web-nexttec.onrender.com` e o backend `bob-live-api-nexttec.onrender.com` foram criados em plano Free. A Vercel ainda exige conexão/implantação própria. O classificador não exige chave; OpenRouter exige `OPENAI_API_KEY`; o relay temporário Ollama exige `BOB_OLLAMA_RELAY_KEY` igual no Render e no GitHub Actions.

## Alternativas mantidas

- [Oracle Cloud com systemd](deploy/oracle/README.md), para quem tiver uma VM.
- [GitHub Actions web-live temporário](.github/workflows/bob-live.yml), para sessões experimentais com Ollama/Piper, com limite de execução e túnel temporário.

## Direitos e créditos

Criado originalmente por **Luis Felipe/LSzerodev**. O submódulo `upstream/` conserva o código, [LICENSE](upstream/LICENSE) e [NOTICE](upstream/NOTICE.md). A comunidade oficial do projeto original está em https://t.me/+dodaVsUWVoQ0Yjhh. O personagem, modelo 3D, imagens e marcas têm titulares de direitos; não assumimos autorização automática para uso comercial nem clonagem da voz original. Use integrações TikTok conforme as condições da plataforma.
