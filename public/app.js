const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${protocol}://${location.host}`);

const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const roomsGrid = document.getElementById('rooms-grid');
const lobbyStatus = document.getElementById('lobby-status');
const roomInfo = document.getElementById('room-info');
const cells = document.querySelectorAll('.cell');
const boardEl = document.getElementById('board');
const connectionStatus = document.getElementById('connection-status');
const playerInfo = document.getElementById('player-info');
const turnInfo = document.getElementById('turn-info');
const gameStatus = document.getElementById('game-status');
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreDraws = document.getElementById('score-draws');
const resetBtn = document.getElementById('reset');
const leaveRoomBtn = document.getElementById('leave-room');
const winModal = document.getElementById('win-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalIcon = document.getElementById('modal-icon');
const modalClose = document.getElementById('modal-close');

const STATUS_LABELS = {
    empty: 'Disponible',
    waiting: '1 jugador',
    playing: 'En juego',
    finished: 'Terminada'
};

let mySymbol = null;
let myRole = null;
let currentRoomId = null;
let inGame = false;
let lobbyRooms = [];
let previousBoard = ['', '', '', '', '', '', '', '', ''];
let modalShownForGame = false;

let gameState = {
    board: ['', '', '', '', '', '', '', '', ''],
    currentPlayer: 'X',
    gameOver: false,
    winner: null,
    winLine: null,
    scores: { x: 0, o: 0, draws: 0 },
    players: { xConnected: false, oConnected: false, playerCount: 0 }
};

function setConnectionStatus(status) {
    connectionStatus.className = 'badge';

    if (status === 'connected') {
        connectionStatus.classList.add('badge--connected');
        connectionStatus.textContent = 'Conectado';
        return;
    }

    if (status === 'disconnected') {
        connectionStatus.classList.add('badge--disconnected');
        connectionStatus.textContent = 'Desconectado';
        return;
    }

    connectionStatus.classList.add('badge--connecting');
    connectionStatus.textContent = 'Conectando...';
}

function showLobby() {
    inGame = false;
    currentRoomId = null;
    mySymbol = null;
    myRole = null;
    lobbyView.classList.remove('hidden');
    gameView.classList.add('hidden');
    roomInfo.textContent = 'Lobby';
    playerInfo.textContent = '—';
    playerInfo.className = 'panel-value';
    hideWinModal();
    modalShownForGame = false;
}

function showGame() {
    inGame = true;
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    roomInfo.textContent = `Sala ${currentRoomId}`;
}

function renderLobby() {
    roomsGrid.innerHTML = '';

    lobbyRooms.forEach(room => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `room-card room-card--${room.status}`;

        if (currentRoomId === room.id) {
            btn.classList.add('room-card--active');
        }

        const isFull = room.playerCount >= 2;
        const canJoinAsPlayer = room.playerCount < 2;

        btn.innerHTML = `
            <span class="room-card-number">Sala ${room.id}</span>
            <span class="room-card-status">${STATUS_LABELS[room.status] || room.status}</span>
            <span class="room-card-players">${room.playerCount}/2 jugadores</span>
            ${room.spectatorCount > 0 ? `<span class="room-card-spectators">${room.spectatorCount} espectador${room.spectatorCount > 1 ? 'es' : ''}</span>` : ''}
        `;

        btn.addEventListener('click', () => {
            socket.send(JSON.stringify({
                type: 'joinRoom',
                roomId: room.id
            }));
        });

        roomsGrid.appendChild(btn);
    });

    const available = lobbyRooms.filter(r => r.playerCount < 2).length;
    lobbyStatus.textContent = available > 0
        ? `${available} sala${available > 1 ? 's' : ''} con lugar para jugar`
        : 'Todas las salas tienen 2 jugadores · podés entrar como espectador';
}

function updatePlayerInfo() {
    if (myRole === 'spectator') {
        playerInfo.textContent = 'Partida completa · Espectador';
        playerInfo.className = 'panel-value';
        return;
    }

    if (mySymbol === 'X') {
        playerInfo.textContent = 'Sos el jugador X';
        playerInfo.className = 'panel-value turn-x';
        return;
    }

    if (mySymbol === 'O') {
        playerInfo.textContent = 'Sos el jugador O';
        playerInfo.className = 'panel-value turn-o';
        return;
    }

    playerInfo.textContent = '—';
    playerInfo.className = 'panel-value';
}

function updateTurnInfo() {
    if (gameState.gameOver) {
        turnInfo.textContent = '—';
        turnInfo.className = 'panel-value';
        return;
    }

    if (gameState.players.playerCount < 2) {
        turnInfo.textContent = '—';
        turnInfo.className = 'panel-value';
        return;
    }

    turnInfo.textContent = `Turno ${gameState.currentPlayer}`;
    turnInfo.className = gameState.currentPlayer === 'X'
        ? 'panel-value turn-x'
        : 'panel-value turn-o';
}

function updateGameStatus() {
    gameStatus.className = 'game-status';

    if (myRole === 'spectator') {
        if (gameState.gameOver) {
            if (gameState.winner === 'draw') {
                gameStatus.textContent = 'Empate';
                gameStatus.classList.add('status-draw');
                return;
            }

            gameStatus.textContent = `Ganó ${gameState.winner}`;
            gameStatus.classList.add(
                gameState.winner === 'X' ? 'status-win-x' : 'status-win-o'
            );
            return;
        }

        if (gameState.players.playerCount < 2) {
            gameStatus.textContent = 'Esperando segundo jugador';
            return;
        }

        gameStatus.textContent = `Partida completa · Turno ${gameState.currentPlayer}`;
        return;
    }

    if (!mySymbol) {
        gameStatus.textContent = 'Esperando asignación...';
        return;
    }

    if (gameState.players.playerCount < 2) {
        gameStatus.textContent = 'Esperando segundo jugador';
        return;
    }

    if (gameState.gameOver) {
        if (gameState.winner === 'draw') {
            gameStatus.textContent = 'Empate';
            gameStatus.classList.add('status-draw');
            return;
        }

        gameStatus.textContent = `Ganó ${gameState.winner}`;
        gameStatus.classList.add(
            gameState.winner === 'X' ? 'status-win-x' : 'status-win-o'
        );
        return;
    }

    if (gameState.currentPlayer === mySymbol) {
        gameStatus.textContent = `Turno ${mySymbol} · ¡Es tu turno!`;
        gameStatus.classList.add(
            mySymbol === 'X' ? 'status-win-x' : 'status-win-o'
        );
        return;
    }

    gameStatus.textContent = `Turno ${gameState.currentPlayer}`;
}

function updateScores() {
    scoreX.textContent = gameState.scores.x;
    scoreO.textContent = gameState.scores.o;
    scoreDraws.textContent = gameState.scores.draws;
}

function canPlayCell(index) {
    if (myRole === 'spectator' || !mySymbol) {
        return false;
    }

    if (gameState.gameOver) {
        return false;
    }

    if (gameState.players.playerCount < 2) {
        return false;
    }

    if (gameState.currentPlayer !== mySymbol) {
        return false;
    }

    return gameState.board[index] === '';
}

function updateCellInteractivity() {
    cells.forEach((cell, index) => {
        const playable = canPlayCell(index);
        cell.classList.toggle('disabled', !playable && !gameState.board[index]);
    });

    boardEl.classList.toggle('game-over', gameState.gameOver);
}

function showWinModal() {
    if (!gameState.gameOver || modalShownForGame) {
        return;
    }

    modalShownForGame = true;

    if (gameState.winner === 'draw') {
        modalIcon.textContent = '🤝';
        modalTitle.textContent = '¡Empate!';
        modalMessage.textContent = 'Nadie ganó esta ronda';
        modalMessage.className = 'modal-message';
    } else {
        modalIcon.textContent = '🏆';
        modalTitle.textContent = '¡Victoria!';
        modalMessage.textContent = `Ganó ${gameState.winner}`;
        modalMessage.className = `modal-message win-${gameState.winner.toLowerCase()}`;
    }

    winModal.classList.remove('hidden');
    winModal.setAttribute('aria-hidden', 'false');
}

function hideWinModal() {
    winModal.classList.add('hidden');
    winModal.setAttribute('aria-hidden', 'true');
}

function renderBoard() {
    const winLineSet = new Set(gameState.winLine || []);

    gameState.board.forEach((value, index) => {
        const cell = cells[index];
        const wasEmpty = previousBoard[index] === '';
        const isNew = wasEmpty && value !== '';

        cell.textContent = value;
        cell.classList.toggle('x', value === 'X');
        cell.classList.toggle('o', value === 'O');
        cell.classList.toggle('filled', value !== '');
        cell.classList.toggle('winning', winLineSet.has(index));

        if (isNew) {
            cell.classList.remove('placed');
            void cell.offsetWidth;
            cell.classList.add('placed');
        }
    });

    previousBoard = [...gameState.board];
    updateCellInteractivity();
}

function renderState(state) {
    const wasGameOver = gameState.gameOver;

    gameState = {
        board: state.board,
        currentPlayer: state.currentPlayer,
        gameOver: state.gameOver,
        winner: state.winner,
        winLine: state.winLine || null,
        scores: state.scores || { x: 0, o: 0, draws: 0 },
        players: state.players || {
            xConnected: false,
            oConnected: false,
            playerCount: 0
        }
    };

    if (!state.gameOver) {
        modalShownForGame = false;
    }

    renderBoard();
    updateScores();
    updatePlayerInfo();
    updateTurnInfo();
    updateGameStatus();

    if (gameState.gameOver && !wasGameOver) {
        showWinModal();
    }
}

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = Number(cell.dataset.index);

        if (!canPlayCell(index)) {
            return;
        }

        socket.send(JSON.stringify({
            type: 'move',
            index
        }));
    });
});

resetBtn.addEventListener('click', () => {
    hideWinModal();
    modalShownForGame = false;

    socket.send(JSON.stringify({
        type: 'reset'
    }));
});

leaveRoomBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
        type: 'leaveRoom'
    }));
});

modalClose.addEventListener('click', hideWinModal);

winModal.querySelector('.modal-backdrop')
    .addEventListener('click', hideWinModal);

socket.addEventListener('open', () => {
    setConnectionStatus('connected');
});

socket.addEventListener('close', () => {
    setConnectionStatus('disconnected');
    lobbyStatus.textContent = 'Conexión perdida. Recargá la página.';
    gameStatus.textContent = 'Conexión perdida. Recargá la página.';
});

socket.addEventListener('error', () => {
    setConnectionStatus('disconnected');
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'lobby') {
        lobbyRooms = data.rooms;
        renderLobby();
        return;
    }

    if (data.type === 'joined') {
        currentRoomId = data.roomId;
        mySymbol = data.symbol;
        myRole = data.role;
        showGame();
        updatePlayerInfo();
        updateGameStatus();
        return;
    }

    if (data.type === 'leftRoom') {
        showLobby();
        return;
    }

    if (data.type === 'state') {
        if (data.roomId !== currentRoomId) {
            return;
        }

        renderState(data);
    }
});

showLobby();
setConnectionStatus('connecting');
