(function () {
  const state = {
    players: {},
    myPlayerId: null,
    viewingPlayerId: null,
    mode: 'check',
    selectedCellIndex: null
  };
  const FIXED_PROFILES = [
    { id: 'jeon_seungdeok', name: '전승덕' },
    { id: 'jeon_hyeji', name: '전혜지' },
    { id: 'seo_hyeonjun', name: '서현준' },
    { id: 'joo_hyebin', name: '주혜빈' }
  ];

  const el = {
    countdownTimer: document.getElementById('countdownTimer'),
    profileSelect: document.getElementById('profileSelect'),
    createOrLoadBtn: document.getElementById('createOrLoadBtn'),
    currentProfile: document.getElementById('currentProfile'),
    currentProfileAvatar: document.getElementById('currentProfileAvatar'),
    playerList: document.getElementById('playerList'),
    boardContainer: document.getElementById('boardContainer'),
    editModal: document.getElementById('editModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    saveCellBtn: document.getElementById('saveCellBtn'),
    emojiInput: document.getElementById('emojiInput'),
    textInput: document.getElementById('textInput'),
    emojiQuickPick: document.getElementById('emojiQuickPick'),
    musicStatus: document.getElementById('musicStatus'),
    musicPlayBtn: document.getElementById('musicPlayBtn'),
    musicPauseBtn: document.getElementById('musicPauseBtn'),
    musicMuteBtn: document.getElementById('musicMuteBtn'),
    musicVolume: document.getElementById('musicVolume'),
    ytPlayerHost: document.getElementById('ytPlayerHost')
  };
  const quickEmojis = ['🌟', '🌈', '🎀', '🧸', '🍀', '☀️', '🍓', '🎵', '🫧', '🐰', '🌼', '🧁', '📚', '🎬', '🏃', '🍵', '💌', '🧩', '🌷', '✨', '💖', '🎉', '🛼', '🧃'];
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
  let ytPlayer = null;
  let musicMuted = true;
  let supabaseClient = null;
  let hasLoadedServerOnce = false;
  let syncInFlight = false;
  let syncQueued = false;
  let pullInFlight = false;
  let lastServerSignature = '';
  const PROFILE_AVATARS = {
    jeon_seungdeok: { emoji: '🦥', src: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f9a5.svg' },
    seo_hyeonjun: { emoji: '🍉', src: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f349.svg' },
    joo_hyebin: { emoji: '🐸', src: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f438.svg' },
    jeon_hyeji: { emoji: '🦒', src: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f992.svg' }
  };

  function buildFixedPlayers(existingPlayers) {
    const now = new Date().toISOString();
    const result = {};
    const list = Object.values(existingPlayers || {});

    FIXED_PROFILES.forEach(function (profile) {
      const byId = existingPlayers[profile.id];
      const byName = list.find(function (p) { return p.name === profile.name; });
      const source = byId || byName || null;
      result[profile.id] = {
        id: profile.id,
        name: profile.name,
        board: source && Array.isArray(source.board) && source.board.length === 25 ? source.board : window.BingoData.makeRandomBoard(),
        createdAt: source && source.createdAt ? source.createdAt : now,
        updatedAt: source && source.updatedAt ? source.updatedAt : now,
        winnerAt: source && source.winnerAt ? source.winnerAt : null
      };
    });

    return result;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('ko-KR');
  }

  function avatarForProfileId(profileId, className, alt) {
    const mapped = PROFILE_AVATARS[profileId];
    if (!mapped) return className ? '<span class="' + className + '">🙂</span>' : '🙂';
    if (!className) return '<img src="' + mapped.src + '" alt="' + alt + '">';
    return '<span class="' + className + '"><img src="' + mapped.src + '" alt="' + alt + '"></span>';
  }

  function getOrderedPlayers() {
    return FIXED_PROFILES.map(function (profile) {
      return state.players[profile.id];
    }).filter(Boolean);
  }

  function initializeFixedProfiles() {
    if (el.profileSelect) el.profileSelect.value = FIXED_PROFILES[0].id;
  }

  function getActivePlayer() {
    return state.viewingPlayerId ? state.players[state.viewingPlayerId] || null : null;
  }

  function ensureViewingPlayer() {
    if (state.viewingPlayerId && state.players[state.viewingPlayerId]) return;
    const first = getOrderedPlayers()[0];
    state.viewingPlayerId = first ? first.id : null;
  }

  function persistAndRender() {
    // Keep local signature in sync so periodic pulls do not cause unnecessary full re-renders.
    lastServerSignature = createPlayersSignature(state.players);
    render();
    requestServerSync();
  }

  function createPlayersSignature(players) {
    return FIXED_PROFILES.map(function (profile) {
      const p = players[profile.id];
      if (!p) return profile.id + ':missing';
      const boardSig = (p.board || []).map(function (cell) {
        return [
          cell && cell.emoji ? cell.emoji : '',
          cell && cell.text ? cell.text : '',
          cell && cell.checked ? '1' : '0'
        ].join('~');
      }).join('|');
      return [
        p.id,
        p.updatedAt || '',
        p.winnerAt || '',
        boardSig
      ].join(':');
    }).join('||');
  }

  function updateCountdown() {
    const target = new Date('2026-12-31T23:59:59');
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) {
      el.countdownTimer.textContent = '2026년 12월 31일이 지났습니다.';
      return;
    }

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    el.countdownTimer.textContent = '2026년 12월 31일까지 ' + days + '일 ' + hours + '시간 ' + minutes + '분 ' + seconds + '초';
  }

  function renderCurrentProfile() {
    if (!state.myPlayerId || !state.players[state.myPlayerId]) {
      el.currentProfile.textContent = '로그인 없음';
      el.currentProfileAvatar.innerHTML = '🙂';
      return;
    }

    const mine = state.players[state.myPlayerId];
    const viewingMine = state.viewingPlayerId === state.myPlayerId;
    if (el.profileSelect) el.profileSelect.value = state.myPlayerId;
    el.currentProfileAvatar.innerHTML = avatarForProfileId(mine.id, '', mine.name);
    el.currentProfile.innerHTML = '<strong>' + escapeHtml(mine.name) + '</strong>' +
      (viewingMine ? ' · 내 보드' : ' · 다른 보드 보는 중');
  }

  function getCellCenter(cell, boardRect) {
    const rect = cell.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2
    };
  }

  function renderCompletedLineOverlay(lines) {
    const board = el.boardContainer.querySelector('.board');
    const overlay = el.boardContainer.querySelector('#lineOverlay');
    if (!board || !overlay) return;

    const cells = board.querySelectorAll('[data-cell-index]');
    const boardRect = board.getBoundingClientRect();
    overlay.setAttribute('viewBox', '0 0 ' + boardRect.width + ' ' + boardRect.height);
    overlay.setAttribute('width', boardRect.width);
    overlay.setAttribute('height', boardRect.height);
    overlay.innerHTML = '';

    lines.forEach(function (line, idx) {
      const startCell = cells[line[0]];
      const endCell = cells[line[line.length - 1]];
      if (!startCell || !endCell) return;

      const start = getCellCenter(startCell, boardRect);
      const end = getCellCenter(endCell, boardRect);
      const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineEl.setAttribute('x1', start.x);
      lineEl.setAttribute('y1', start.y);
      lineEl.setAttribute('x2', end.x);
      lineEl.setAttribute('y2', end.y);
      lineEl.setAttribute('class', 'bingo-line');
      lineEl.style.animationDelay = (idx * 0.09) + 's';
      overlay.appendChild(lineEl);
    });
  }

  function updateMusicStatus(text) {
    if (el.musicStatus) el.musicStatus.textContent = text;
  }

  async function pullPlayersFromServer() {
    if (pullInFlight || syncInFlight) return;
    if (!supabaseClient) return;
    pullInFlight = true;
    try {
      const result = await supabaseClient
        .from('profiles')
        .select('id,name,board_json,created_at,updated_at,winner_at');
      if (result.error || !Array.isArray(result.data)) return;

      const players = {};
      result.data.forEach(function (row) {
        players[row.id] = {
          id: row.id,
          name: row.name,
          board: row.board_json,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          winnerAt: row.winner_at
        };
      });

      const remoteFixed = buildFixedPlayers(players);
      const nextSignature = createPlayersSignature(remoteFixed);
      if (!hasLoadedServerOnce) {
        state.players = remoteFixed;
        state.myPlayerId = null;
        state.viewingPlayerId = FIXED_PROFILES[0].id;
        hasLoadedServerOnce = true;
        lastServerSignature = nextSignature;
        render();
        return;
      }
      if (nextSignature === lastServerSignature) return;

      state.players = remoteFixed;
      lastServerSignature = nextSignature;
      render();
    } catch (error) {
      // noop: keep local state when server temporarily unavailable
    } finally {
      pullInFlight = false;
    }
  }

  async function pushPlayersToServer() {
    if (!supabaseClient) return;
    const rows = Object.values(state.players).map(function (player) {
      return {
        id: player.id,
        name: player.name,
        board_json: player.board,
        created_at: player.createdAt,
        updated_at: player.updatedAt,
        winner_at: player.winnerAt || null
      };
    });
    const result = await supabaseClient
      .from('profiles')
      .upsert(rows, { onConflict: 'id' });
    if (result.error) throw result.error;
  }

  function requestServerSync() {
    if (!supabaseClient) return;
    if (!hasLoadedServerOnce) return;
    if (syncInFlight) {
      syncQueued = true;
      return;
    }

    syncInFlight = true;
    (async function run() {
      try {
        do {
          syncQueued = false;
          await pushPlayersToServer();
        } while (syncQueued);
      } catch (error) {
        syncQueued = false;
      } finally {
        syncInFlight = false;
      }
    })();
  }

  function setMusicButtonState() {
    if (!ytPlayer || !window.YT || !window.YT.PlayerState) return;
    const stateCode = ytPlayer.getPlayerState();
    el.musicPlayBtn.classList.toggle('is-active', stateCode === window.YT.PlayerState.PLAYING);
    el.musicPauseBtn.classList.toggle('is-active', stateCode === window.YT.PlayerState.PAUSED);
    el.musicMuteBtn.classList.toggle('is-active', musicMuted);
  }

  function initYouTubePlayer() {
    if (!window.YT || !window.YT.Player || ytPlayer) return;

    ytPlayer = new window.YT.Player('ytPlayerHost', {
      height: '1',
      width: '1',
      videoId: 'jfKfPfyJRdk',
      playerVars: {
        autoplay: 1,
        controls: 0,
        loop: 1,
        playlist: 'jfKfPfyJRdk',
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: function (event) {
          event.target.setVolume(Number(el.musicVolume.value));
          event.target.mute();
          updateMusicStatus('준비됨 (음소거)');
          event.target.playVideo();
          setMusicButtonState();
        },
        onStateChange: function (event) {
          if (event.data === window.YT.PlayerState.PLAYING) updateMusicStatus(musicMuted ? '재생 중 (음소거)' : '재생 중');
          if (event.data === window.YT.PlayerState.PAUSED) updateMusicStatus('일시정지');
          if (event.data === window.YT.PlayerState.ENDED) updateMusicStatus('다음 곡으로 루프');
          setMusicButtonState();
        }
      }
    });
  }

  function switchToPlayer(playerId) {
    if (!state.players[playerId]) return;
    state.viewingPlayerId = playerId;
    state.selectedCellIndex = null;
    closeEditModal();
    persistAndRender();
  }

  function loginSelectedProfile() {
    if (!hasLoadedServerOnce) {
      alert('서버 데이터 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    const id = el.profileSelect.value;
    if (!state.players[id]) return;
    state.myPlayerId = id;
    state.viewingPlayerId = id;
    state.mode = 'check';
    state.selectedCellIndex = null;
    persistAndRender();
  }

  function setMode(mode) {
    state.mode = mode;
    state.selectedCellIndex = null;
    closeEditModal();
    persistAndRender();
  }

  function openEditModal(index) {
    const player = getActivePlayer();
    if (!player) return;
    const cell = player.board[index];
    if (!cell) return;

    state.selectedCellIndex = index;
    el.emojiInput.value = cell.emoji || '🌟';
    el.textInput.value = cell.text || '새 목표';
    el.editModal.classList.remove('hidden');
    el.editModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditModal() {
    el.editModal.classList.add('hidden');
    el.editModal.setAttribute('aria-hidden', 'true');
    state.selectedCellIndex = null;
  }

  function toggleOrSelectCell(index) {
    const player = getActivePlayer();
    if (!player) return;
    const isOwner = player.id === state.myPlayerId;
    if (!isOwner || player.winnerAt) return;

    if (state.mode === 'edit') {
      openEditModal(index);
      return;
    }

    player.board[index].checked = !player.board[index].checked;
    player.updatedAt = new Date().toISOString();
    window.BingoGame.updateWinner(player);
    persistAndRender();
  }

  function saveCellEdit() {
    const player = getActivePlayer();
    if (!player || player.id !== state.myPlayerId || player.winnerAt) return;
    if (state.selectedCellIndex === null) return;

    const emoji = (el.emojiInput.value || '🌟').trim().slice(0, 4) || '🌟';
    const text = (el.textInput.value || '새 목표').trim().slice(0, 40) || '새 목표';

    player.board[state.selectedCellIndex].emoji = emoji;
    player.board[state.selectedCellIndex].text = text;
    player.updatedAt = new Date().toISOString();

    closeEditModal();
    persistAndRender();
  }

  function randomFillMyBoard() {
    const player = getActivePlayer();
    if (!player || player.id !== state.myPlayerId || player.winnerAt) return;

    if (!confirm('정말 랜덤으로 다시 채울까요? 현재 빙고칸 내용과 체크 상태가 초기화됩니다.')) return;
    if (!confirm('마지막 확인: 되돌릴 수 없습니다. 계속할까요?')) return;

    player.board = window.BingoData.makeRandomBoard();
    player.updatedAt = new Date().toISOString();
    player.winnerAt = null;
    state.selectedCellIndex = null;

    persistAndRender();
  }

  function renderPlayerList() {
    if (!hasLoadedServerOnce) {
      el.playerList.innerHTML = '<div class="empty">서버 데이터 불러오는 중...</div>';
      return;
    }
    const players = getOrderedPlayers();
    if (players.length === 0) {
      el.playerList.innerHTML = '<div class="empty">아직 참여자가 없습니다.</div>';
      return;
    }

    el.playerList.innerHTML = players.map(function (player) {
      const lines = window.BingoGame.countLines(player.board);
      const isMine = player.id === state.myPlayerId;
      const active = player.id === state.viewingPlayerId;

      return '' +
        '<button class="player-btn ' + (active ? 'active' : '') + ' ' + (isMine ? 'mine' : '') + '" data-player-id="' + player.id + '">' +
        '<div class="player-title">' + avatarForProfileId(player.id, 'list-avatar', player.name) + '<strong>' + escapeHtml(player.name) + '</strong> ' + (isMine ? '<span class="chip">MY</span>' : '') + '</div>' +
        '<div class="player-meta">' +
        '<span class="chip ' + (lines >= 3 ? 'ok' : '') + '">빙고줄 ' + lines + '</span>' +
        (player.winnerAt ? '<span class="chip warn">우승</span>' : '') +
        '<span class="chip">생성 ' + formatDate(player.createdAt) + '</span>' +
        '</div>' +
        '</button>';
    }).join('');

    el.playerList.querySelectorAll('[data-player-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchToPlayer(btn.getAttribute('data-player-id'));
      });
    });
  }

  function renderBoard() {
    ensureViewingPlayer();
    const player = getActivePlayer();

    if (!player) {
      el.boardContainer.innerHTML = '<div class="empty">왼쪽에서 프로필을 선택해 로그인해주세요.</div>';
      return;
    }

    const isOwner = player.id === state.myPlayerId;
    const completedLines = window.BingoGame.getCompletedLines(player.board);
    const lines = completedLines.length;
    const marked = window.BingoGame.countMarked(player.board);
    const boardHtml = player.board.map(function (cell, index) {
      const classes = [
        'cell',
        cell.checked ? 'checked' : '',
        !isOwner ? 'readonly' : '',
        state.mode === 'edit' && state.selectedCellIndex === index ? 'selected' : ''
      ].filter(Boolean).join(' ');

      return '' +
        '<button class="' + classes + '" data-cell-index="' + index + '">' +
        '<div class="emoji">' + escapeHtml(cell.emoji || '🌟') + '</div>' +
        '<div class="text">' + escapeHtml(cell.text || '새 목표') + '</div>' +
        '</button>';
    }).join('');

    const winnerHtml = player.winnerAt
      ? '<div class="win-banner">🏆 ' + escapeHtml(player.name) + '님 우승! (3줄 이상 완성)<br>우승 후에는 기록 보존을 위해 수정/체크가 잠깁니다.</div>'
      : '';

    const controlsHtml = (isOwner && !player.winnerAt)
      ? '<div class="mode-row">' +
      '<button class="mode-btn ' + (state.mode === 'check' ? 'active' : '') + '" id="checkModeBtn">체크 모드</button>' +
      '<button class="mode-btn ' + (state.mode === 'edit' ? 'active' : '') + '" id="editModeBtn">편집 모드</button>' +
      '<button class="btn mint" id="randomFillBtn">랜덤으로 다시 채우기</button>' +
      '</div>' +
      (state.mode === 'edit'
        ? '<div class="small" style="margin-top:10px;">편집 모드에서는 칸을 누르면 팝업이 열립니다.</div>'
        : '')
      : '';

    el.boardContainer.innerHTML = '' +
      '<div class="board-head">' +
      '<h2 class="board-title">' + escapeHtml(player.name) + '님의 빙고판</h2>' +
      '<div class="board-meta">' +
      '<span class="chip">체크 ' + marked + '/25</span>' +
      '<span class="chip ' + (lines >= 3 ? 'ok' : '') + '">빙고줄 ' + lines + '</span>' +
      '<span class="chip">마지막 수정 ' + formatDate(player.updatedAt) + '</span>' +
      (isOwner ? '<span class="chip">내 빙고판</span>' : '<span class="chip warn">읽기 전용</span>') +
      '</div>' +
      '</div>' +
      '<div class="board-wrap">' +
      '<div class="board">' + boardHtml + '</div>' +
      '<svg id="lineOverlay" class="line-overlay" aria-hidden="true"></svg>' +
      '</div>' +
      winnerHtml + controlsHtml;

    el.boardContainer.querySelectorAll('[data-cell-index]').forEach(function (cellBtn) {
      cellBtn.addEventListener('click', function () {
        toggleOrSelectCell(Number(cellBtn.getAttribute('data-cell-index')));
      });
    });
    renderCompletedLineOverlay(completedLines);

    const checkModeBtn = document.getElementById('checkModeBtn');
    const editModeBtn = document.getElementById('editModeBtn');
    const randomFillBtn = document.getElementById('randomFillBtn');

    if (checkModeBtn) checkModeBtn.addEventListener('click', function () { setMode('check'); });
    if (editModeBtn) editModeBtn.addEventListener('click', function () { setMode('edit'); });
    if (randomFillBtn) randomFillBtn.addEventListener('click', randomFillMyBoard);
  }

  function bindModalEvents() {
    el.modalCloseBtn.addEventListener('click', closeEditModal);
    el.modalCancelBtn.addEventListener('click', closeEditModal);
    el.saveCellBtn.addEventListener('click', saveCellEdit);

    el.editModal.addEventListener('click', function (event) {
      if (event.target === el.editModal) closeEditModal();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !el.editModal.classList.contains('hidden')) {
        closeEditModal();
      }
    });

    el.emojiQuickPick.innerHTML = quickEmojis.map(function (emoji) {
      return '<button class="emoji-btn" type="button" data-emoji="' + emoji + '">' + emoji + '</button>';
    }).join('');

    el.emojiQuickPick.querySelectorAll('[data-emoji]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.emojiInput.value = btn.getAttribute('data-emoji');
      });
    });
  }

  function bindMusicEvents() {
    if (!el.musicPlayBtn) return;

    el.musicPlayBtn.addEventListener('click', function () {
      if (!ytPlayer) return;
      ytPlayer.playVideo();
      if (musicMuted) {
        ytPlayer.unMute();
        musicMuted = false;
      }
      updateMusicStatus('재생 중');
      setMusicButtonState();
    });

    el.musicPauseBtn.addEventListener('click', function () {
      if (!ytPlayer) return;
      ytPlayer.pauseVideo();
      updateMusicStatus('일시정지');
      setMusicButtonState();
    });

    el.musicMuteBtn.addEventListener('click', function () {
      if (!ytPlayer) return;
      if (musicMuted) {
        ytPlayer.unMute();
        musicMuted = false;
        el.musicMuteBtn.textContent = '🔊';
        updateMusicStatus('재생 중');
      } else {
        ytPlayer.mute();
        musicMuted = true;
        el.musicMuteBtn.textContent = '🔇';
        updateMusicStatus('재생 중 (음소거)');
      }
      setMusicButtonState();
    });

    el.musicVolume.addEventListener('input', function () {
      if (!ytPlayer) return;
      ytPlayer.setVolume(Number(el.musicVolume.value));
    });

    window.onYouTubeIframeAPIReady = initYouTubePlayer;
    if (window.YT && window.YT.Player) initYouTubePlayer();
  }

  function render() {
    renderCurrentProfile();
    renderPlayerList();
    renderBoard();
  }

  function bindClickFeedback() {
    document.addEventListener('click', function (event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (!(button.classList.contains('btn') || button.classList.contains('icon-btn') || button.classList.contains('mode-btn'))) return;

      button.classList.remove('click-pop');
      void button.offsetWidth;
      button.classList.add('click-pop');
      setTimeout(function () {
        button.classList.remove('click-pop');
      }, 280);
    });
  }

  el.createOrLoadBtn.addEventListener('click', loginSelectedProfile);

  window.addEventListener('resize', render);

  initializeFixedProfiles();
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  bindModalEvents();
  bindMusicEvents();
  bindClickFeedback();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  ensureViewingPlayer();
  render();
  pullPlayersFromServer();
  setInterval(pullPlayersFromServer, 5000);
})();
