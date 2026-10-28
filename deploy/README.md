# Bob Live 24h — Oracle Cloud ARM64

A stack em `deploy/compose.yaml` coloca no ar: site Godot HTTPS via Caddy, ponte WSS protegida, Node/TikTok para @nexttec_1, Ollama Qwen 0.5B e voz Piper. Os contêineres reiniciam automaticamente, mas **24h não é garantido** por instâncias gratuitas. A transmissão do vídeo ao TikTok ainda requer OBS/LIVE Studio no seu PC.

## Preparação

Crie VM Oracle Always Free Ampere A1 Ubuntu ARM64, com IP público, RAM suficiente e portas 80/443 abertas no firewall da VM e nas regras da Oracle. A criação da conta/VM exige sua ação. Instale Git, Python3, Docker Engine e Compose plugin da [documentação oficial](https://docs.docker.com/engine/install/ubuntu/).

No SSH:

```bash
git clone --recurse-submodules https://github.com/danilo631/Bob_live.git
cd Bob_live
cp deploy/.env.example deploy/.env
nano deploy/.env
chmod 600 deploy/.env
bash deploy/deploy.sh
```

Configure `BOB_DOMAIN=IP_PUBLICO.sslip.io` usando o IP real e uma senha aleatória forte em `BOB_SESSION_KEY`. NÃO faça commit deste arquivo. O Caddy pede HTTPS automaticamente; a emissão do certificado depende do DNS e das portas públicas 80/443. O workflow GitHub `deploy-web.yml` publica a imagem web no GHCR; talvez seja preciso liberar o pacote para leitura pública.

Abra `https://IP_PUBLICO.sslip.io/`, informe a senha e use os botões de teste. Para eventos reais a live @nexttec_1 precisa estar ativa; o conector não oficial TikTok pode ser bloqueado.

## Diagnóstico

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 server
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 piper
```

Atualizar: `git pull --ff-only && bash deploy/deploy.sh`.

O projeto original é de [Luis Felipe / LSzerodev](https://github.com/LSzerodev/bob-live); preserve os arquivos [LICENSE](../upstream/LICENSE) e [NOTICE](../upstream/NOTICE.md). Personagem, modelo e imagens têm direitos de terceiros.
