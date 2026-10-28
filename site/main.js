(() => {
  const game = document.querySelector('#game');
  const video = document.querySelector('#video');
  const state = document.querySelector('#state');
  const full = document.querySelector('#full');
  const reload = document.querySelector('#reload');
  const load = () => {
    video.classList.add('running');
    game.src = 'game/index.html';
    full.disabled = false;
    reload.disabled = false;
    state.textContent = 'Carregando Godot…';
  };
  document.querySelector('#start').addEventListener('click', load);
  game.addEventListener('load', () => {
    state.textContent = 'Jogo aberto · clique nele para ativar áudio';
  });
  game.addEventListener('error', () => {
    state.textContent = 'Não foi possível carregar o export Web';
  });
  full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else video.requestFullscreen?.();
  });
  reload.addEventListener('click', () => {
    state.textContent = 'Reiniciando Godot…';
    game.src = 'game/index.html?v=' + Date.now();
  });
  document.querySelector('#copy').addEventListener('click', async (e) => {
    const cmd = document.querySelector('.command code').textContent;
    try {
      await navigator.clipboard.writeText(cmd);
      e.currentTarget.textContent = 'Copiado!';
    } catch {
      e.currentTarget.textContent = 'Selecione e copie';
    }
  });
})();
