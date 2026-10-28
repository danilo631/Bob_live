# Bob Live — jogo 3D na Web, live no PC

Versão web do projeto **[Live Fenda do Biquíni](https://github.com/LSzerodev/bob-live)** adaptada para a live **TikTok @nexttec_1**.

**Página do jogo:** https://danilo631.github.io/Bob_live/ (requer ativar GitHub Pages e a publicação do workflow).

## Como funciona

- **GitHub Actions**: usa Godot **4.7.2** para exportar o jogo original em HTML5/WebGL 2.0 e publicar um site estático no GitHub Pages. Não mantém servidor, IA ou streaming rodando.
- **GitHub Pages**: renderiza o personagem 3D no navegador, recebe eventos do jogo via WebSocket e reproduz o WAV no próprio navegador com a boca sincronizada.
- **Seu PC (Windows 11)**: executa Node.js com o conector TikTok para **@nexttec_1**, **Ollama** para respostas geradas localmente e **SAPI** para a voz offline do Windows.
- **TikTok LIVE Studio/OBS**: captura o navegador com áudio do PC e transmite para a live que você iniciou. O GitHub não envia vídeo/áudio para o TikTok.

O navegador recebe os WAVs via WebSocket, pois arquivos no disco local não podem ser abertos diretamente por páginas hospedadas. O servidor é acessível **somente em 127.0.0.1:9393**. Não há API pública com suas credenciais.

## 1. Publicar a página

1. Em **Settings → Pages**, selecione **GitHub Actions** como origem da publicação.
2. Em **Actions**, execute **Publicar Bob Live Web (Godot) → Run workflow** (ou faça um push na \`main\`).
3. Confira **Validar e exportar Godot WebGL** e depois **Publicar no GitHub Pages**.
4. Abra https://danilo631.github.io/Bob_live/ e clique em **Abrir personagem 3D**.

Se o Pages não tiver sido habilitado, o build ainda disponibiliza o artefato **bob-live-web** para baixar no Actions. O site só estará público após o deploy completo. Godot Web necessita **WebGL 2.0** no navegador; o preset foi configurado sem threads (compatível com Pages sem headers especiais).

## 2. Iniciar IA e conexão TikTok local no Windows

Instale **Git**, **Python 3.11+**, **Node.js LTS** e **[Ollama](https://ollama.com/download/windows)**. Em PowerShell:

\`\`\`powershell
git clone --recurse-submodules https://github.com/danilo631/Bob_live.git
cd Bob_live
powershell -ExecutionPolicy Bypass -File .\scripts\start_local.ps1
\`\`\`

A primeira execução:
- Prepara uma cópia local do jogo/servidor original em \`.generated/\` **sem editar o submódulo do autor**.
- Instala dependências Node (\`npm ci\`).
- Inicia ou reutiliza Ollama, baixa **qwen2.5:0.5b** e inicia Node com conexão automática a **@nexttec_1**.
- Usa a voz offline SAPI do Windows (não é voz clonada do personagem).

Modelo de respostas melhor, porém um pouco mais pesado:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_local.ps1 -Modelo "qwen2.5:1.5b"
\`\`\`

Para outro usuário, altere \`-TikTok "nexttec_1"\`. O painel local, com simulador e configurações, fica em **http://127.0.0.1:9393**. O site no Pages deve ser aberto **no mesmo computador** que executa o servidor. Mantenha o processo PowerShell aberto enquanto estiver ao vivo.

## 3. Capturar e transmitir

1. Inicie sua live TikTok pela forma autorizada para sua conta.
2. Inicie o servidor local. No painel, confirme que o monitor TikTok conseguiu conectar.
3. Abra o site no **Chrome/Edge no mesmo PC**, clique para abrir o Godot e depois clique dentro do jogo para liberar áudio.
4. No TikTok LIVE Studio/OBS, adicione a janela do navegador e capture o **áudio do sistema**. Ajuste a fonte para **9:16** e teste com o simulador do painel antes de transmitir.

**Importante:** navegadores podem bloquear WebSockets de um site HTTPS para a rede local, ou pedir uma permissão de acesso à rede local. Se o navegador bloquear \`ws://127.0.0.1:9393\`, use a versão nativa original em seu PC; o GitHub Pages não consegue burlar políticas do navegador. Não abra porta 9393 no roteador nem faça um túnel público do painel sem autenticação.

## 4. Desenvolvimento e automação

Arquivos principais:

| Arquivo | Função |
|---|---|
| \`upstream/\` | Submódulo Git do projeto original, fixado em commit testado |
| \`scripts/prepare_web.py\` | Gera cópias adaptadas: impede abrir EXE no navegador, envia WAV via WebSocket e cria preset Web |
| \`scripts/test_web_adapter.py\` | Testes de compatibilidade, segurança de caminho do áudio e opções Web |
| \`scripts/start_local.ps1\` | Inicia modelo Ollama, conector TikTok e voz no Windows |
| \`site/\` | Página estática do GitHub Pages com o jogo 3D |
| \`.github/workflows/deploy-web.yml\` | Testa, exporta Godot Web e publica |
| \`.github/workflows/bob-live.yml\` | Diagnóstico temporário de Ollama/Piper dentro do Actions (não transmite live) |

Para validar os patches sem exportar o Godot:
\`\`\`bash
git submodule update --init --recursive
python3 scripts/prepare_web.py
python3 scripts/test_web_adapter.py
node --check .generated/server/src/bridge.js
\`\`\`

## Limites e licenças

- **GitHub Pages é hospedagem estática**: não oferece back-end de IA rodando continuamente. Actions possui tempo de execução limitado e não é substituto de um servidor de streaming.
- O **conector TikTok é não oficial**, pode sofrer bloqueios, e só recebe eventos de lives existentes; não inicia uma live para você.
- A página precisa de WebGL 2.0, conexão local permitida pelo navegador e clique para liberar áudio.
- Preserve os avisos e créditos: [Luis Felipe/LSzerodev](https://github.com/LSzerodev/bob-live), [LICENSE](upstream/LICENSE), [NOTICE](upstream/NOTICE.md), [comunidade do autor](https://t.me/+dodaVsUWVoQ0Yjhh). O uso comercial de personagem, imagem, modelo 3D e voz está sujeito a direitos e licenças de terceiros. Não há afiliação com TikTok ou Nickelodeon.
