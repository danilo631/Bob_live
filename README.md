# Bob_live — TikTok @nexttec_1 + GitHub Actions

Integração do projeto [Live Fenda do Biquíni](https://github.com/LSzerodev/bob-live) para testar e monitorar eventos da live de **@nexttec_1** em um runner Linux do GitHub Actions, com IA **local no próprio runner**.

> **Atenção:** executar o servidor/IA/voz no Actions não equivale a transmitir a imagem ou o áudio do jogo para o TikTok. O Godot, a captura da janela, o áudio e a transmissão de vídeo precisam de uma máquina de streaming (Windows/Linux com OBS e chave de transmissão, quando disponível). Não existe "live de vídeo" hospedada automaticamente neste workflow.

## Executar

1. Abra **Actions > Bob Live | IA e voz locais > Run workflow**.
2. Informe `nexttec_1` em **usuario**, escolha **teste-local** primeiro e execute.
3. Após o teste, selecione **monitorar-live** para acompanhar uma live pública existente durante o período escolhido.
4. Acesse os logs do job para verificar a conexão, carregamento do modelo e eventos.

O modo `validacao` apenas testa o código (sem baixar modelos). O modo `teste-local` baixa os modelos e verifica Ollama/Piper sem iniciar uma transmissão. `monitorar-live` conecta ao chat/presentes da live se ela estiver acontecendo; se estiver offline, o conector pode reconectar repetidamente.

## Modelos locais (no runner, não na sua máquina)

| Componente | Padrão | Uso |
|---|---|---|
| IA de texto | `qwen2.5:1.5b` (~986 MB de download) | Ollama em CPU, conversas em pt-BR |
| Alternativa leve | `qwen2.5:0.5b` (~398 MB) | Respostas mais rápidas, menor qualidade |
| Voz pt-BR | `pt_BR-faber-medium` (~63 MB) | Piper TTS/ONNX em CPU, sem chave externa |

O fluxo instala o Ollama, baixa o modelo escolhido e instala Piper com a voz brasileira. Os modelos são baixados de seus fornecedores; **não** são commitados no Git. O áudio do Piper é enviado ao backend pela interface `custom`, que já existe no projeto original. A voz é brasileira, **não é uma clonagem da voz do Bob Esponja**.

O Godot não é inicializado aqui e por isso os arquivos WAV não são reproduzidos em uma live por este workflow isolado. Para áudio e vídeo reais, use o projeto original no PC com OBS/TikTok LIVE Studio, ou monte um runner próprio que faça captura e transmissão autorizada.

## Arquivos

- `upstream/`: submódulo do projeto original, travado em um commit conhecido para reprodutibilidade.
- `scripts/piper_server.py`: API local de TTS (somente `127.0.0.1:8022`).
- `.github/workflows/bob-live.yml`: validação do Node, instalação dos modelos, teste da voz e monitoramento.

O submódulo é baixado automaticamente pelo Actions. Se for clonar localmente, use `git clone --recurse-submodules https://github.com/danilo631/Bob_live.git`.

## Segurança, limites e direitos

- **Não** coloque cookies, senhas, chaves RTMP nem tokens no README ou no código; use *Settings > Secrets and variables > Actions*.
- Os logs de Actions de um repositório **público** podem ser visualizados por terceiros e podem conter nomes/comentários da live.
- Um job do GitHub-hosted Actions dura **no máximo seis horas**. Por segurança o workflow limita a duração de monitoramento a **330 minutos**; a máquina é descartada ao terminar.
- O conector TikTok é **não oficial**; pode falhar por bloqueios de rede, mudanças no TikTok ou por `@nexttec_1` não estar ao vivo.
- Não há garantia de acesso remoto ao painel: ele fica em `127.0.0.1` no runner, não publicado na internet.
- O código base é de **Luis Felipe / LSzerodev**. Consulte `upstream/LICENSE` e `upstream/NOTICE.md`: o modelo 3D, imagem de fundo e personagem têm direitos de terceiros. A licença do modelo de voz Piper deve ser verificada antes de uso comercial.
- Comunidade do autor original: https://t.me/+dodaVsUWVoQ0Yjhh

## Problemas comuns

**`user is not live`**: o TikTok não encontrou uma transmissão pública naquele momento. Inicie a live em sua conta e tente novamente.

**`Cannot connect` / bloqueio do TikTok**: o conector não oficial pode rejeitar o IP compartilhado do GitHub. Para uma live estável, prefira executar no PC ou em um runner próprio.

**Demora para responder**: Ollama roda sem GPU no Actions; `qwen2.5:0.5b` reduz consumo mas piora a resposta.

**Voz não gerada**: confira o passo **Teste local do Piper**. O fallback para SAPI do projeto original não funciona no Linux.
