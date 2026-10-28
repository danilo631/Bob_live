# Bob Live 24 horas — Oracle Cloud Always Free (ARM64)

Esta opção substitui a hospedagem temporária do GitHub Actions. O servidor fica numa VM Ubuntu 24.04 e a **mesma VM hospeda a página Godot, IA Ollama, TTS Piper e conector TikTok**, com HTTPS via Caddy.

> O site e o backend podem ficar no ar sem computador pessoal. **Não confunda com uma live de vídeo 24h:** o site apenas rende o personagem quando alguém abre a página. O TikTok não recebe imagem/áudio sozinho. Para transmitir vídeo ininterruptamente é preciso acesso RTMP autorizado e uma etapa separada de renderização/encoder, com disponibilidade e conformidade da conta TikTok.

## 1. Criar VM Oracle

Acesse https://www.oracle.com/br/cloud/free/ e crie uma conta. Em **Compute > Instances**, crie uma VM na sua *home region* usando a forma **VM.Standard.A1.Flex (Ampere ARM64)** com uma configuração dentro da sua cota Always Free (por exemplo, **2 OCPUs e 12 GB RAM**), imagem **Ubuntu 24.04** e chave SSH. A Oracle não garante disponibilidade de A1 em todas as regiões; instâncias Always Free ociosas podem ser recuperadas.

Requisitos de rede:
- Atribua endereço IPv4 público à instância.
- Abra **TCP 80 e 443** em **Networking > VCN > Security List ou Network Security Group**, além das permissões de firewall do Ubuntu, se aplicável.
- Mantenha **SSH TCP 22** restrito ao seu IP; **não** abra 9393, 9494, 8022 ou 11434 à internet.
- Para começar, o script utiliza automaticamente o domínio gratuito no formato `IP.sslip.io`, cujo DNS aponta para o próprio IP. Se tiver domínio próprio, use `BOB_DOMAIN=seu-dominio.com` depois de configurar o registro A.
- A emissão do certificado HTTPS pelo Caddy depende do DNS e de 80/443 acessíveis externamente. Certificados para sslip.io podem sofrer rate limits. Um domínio próprio é mais robusto.

## 2. Instalar tudo no servidor

Entre por SSH:

```bash
ssh -i sua-chave.key ubuntu@IP_PUBLICO
```

Depois execute na VM:

```bash
sudo apt-get update
sudo apt-get install -y git curl
git clone --recurse-submodules https://github.com/danilo631/Bob_live.git
cd Bob_live
sudo bash deploy/oracle/install.sh
```

O instalador faz o seguinte:
1. Instala Node.js 22, Python, Piper, Ollama, Godot 4.7.2 e Caddy.
2. Baixa `qwen2.5:0.5b` e a voz `pt_BR-faber-medium`.
3. Exporta o jogo Godot em HTML5/WebGL 2.0.
4. Instala serviços `bob-live-node`, `bob-live-piper` e `bob-live-bridge` no **systemd**, com `Restart=always`.
5. Configura HTTPS com Caddy para servir o site e apenas as rotas de API/WebSocket autorizadas; o painel administrativo continua em localhost.

Na primeira execução, baixar/exportar Godot pode consumir alguns gigabytes de disco temporário. Os serviços são reiniciados automaticamente, mas uma VM que for desligada ou recuperada pela Oracle deixa de responder.

## 3. Abrir a página e testar

No fim, o instalador apresenta o endereço `https://SEU_IP.sslip.io/` (ou seu domínio próprio). No navegador, a URL do servidor deve aparecer preenchida automaticamente. Para recuperar a senha gerada no servidor, use **somente no seu terminal SSH privado**:

```bash
sudo sed -n 's/^BOB_SESSION_KEY=//p' /etc/bob-live/bob.env
```

Cole a senha na página e selecione **Conectar IA + Voz + TikTok**. Clique dentro do personagem 3D para permitir áudio. Use os botões de simulação de comentário e presente. Se `@nexttec_1` estiver em uma live pública e o conector funcionar a partir do IP da Oracle, os eventos reais chegarão ao Bob.

**Não cole a senha em issues, comentários, chats públicos ou logs de Actions.** O arquivo `/etc/bob-live/bob.env` pertence ao root e fica com modo 600.

## 4. Atualizações e diagnóstico

```bash
# Verificar serviços
sudo systemctl status bob-live-node bob-live-piper bob-live-bridge caddy ollama --no-pager
# Ver apenas as ultimas mensagens do servidor
sudo journalctl -u bob-live-node -n 70 --no-pager
# Health check local (sem senha, nao inclui dados privados)
curl -fsS http://127.0.0.1:9494/health
# Atualizar código, modelos reutilizados e recompilar o Godot
sudo bash deploy/oracle/install.sh
```

Caso atualize o repositório instalado, o script busca a branch `main` com `git merge --ff-only`; alterações locais na cópia instalada podem impedir a atualização. Faça backup antes de sobrescrever qualquer configuração.

Modelo mais forte, se a VM suportar a latência:

```bash
sudo env BOB_MODEL=qwen2.5:1.5b bash deploy/oracle/install.sh
```

Configuração de domínio próprio:

```bash
sudo env BOB_DOMAIN=live.seudominio.com bash deploy/oracle/install.sh
```

## Segurança e limitações

- A ponte WebSocket exige senha e uma única origem HTTPS válida. Rotas de configuração, segredos e o painel original não são publicados.
- Caddy termina TLS; Node, Ollama, Piper e a ponte escutam apenas no loopback `127.0.0.1`.
- A IA é local na VM, não uma API paga; a latência depende da CPU e da demanda de comentários.
- Serviço 24h **não garante SLA de 100%**, capacidade A1 ou sucesso do conector TikTok. A Oracle pode recuperar VMs ociosas.
- GitHub Actions continua útil para testar o código e não precisa executar um job contínuo.
- A voz Piper é uma voz pt-BR com alteração de pitch, não uma clonagem da voz original do personagem. Veja direitos de terceiros em [NOTICE do projeto original](../../upstream/NOTICE.md).
- Para transmissão de imagem/áudio ao TikTok, use ferramentas e credenciais RTMP autorizadas pela plataforma. **Não compartilhe chave de transmissão** em arquivos públicos.
