const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

const MAX_ROOMS = 10;

const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

const clients = new Map();

const rooms = new Map();

function createEmptyGameState() {
    return {
        board: ['', '', '', '', '', '', '', '', ''],
        currentPlayer: 'X',
        gameOver: false,
        winner: null,
        winLine: null
    };
}

function createEmptyScores() {
    return { x: 0, o: 0, draws: 0 };
}

function initRooms() {
    for (let id = 1; id <= MAX_ROOMS; id += 1) {
        rooms.set(id, {
            gameState: createEmptyGameState(),
            scores: createEmptyScores(),
            clients: new Map()
        });
    }
}

initRooms();

function checkWinner(board) {
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;

        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return {
                winner: board[a],
                winLine: pattern
            };
        }
    }

    if (!board.includes('')) {
        return {
            winner: 'draw',
            winLine: null
        };
    }

    return {
        winner: null,
        winLine: null
    };
}

function getPlayerSlots(room) {
    const symbols = Array.from(room.clients.values())
        .map(client => client.symbol)
        .filter(Boolean);

    return {
        xConnected: symbols.includes('X'),
        oConnected: symbols.includes('O'),
        playerCount: symbols.length
    };
}

function assignSymbol(room) {
    const { xConnected, oConnected } = getPlayerSlots(room);

    if (!xConnected) {
        return 'X';
    }

    if (!oConnected) {
        return 'O';
    }

    return null;
}

function getRoomStatus(room) {
    const players = getPlayerSlots(room);

    if (players.playerCount === 0) {
        return 'empty';
    }

    if (players.playerCount === 1) {
        return 'waiting';
    }

    if (room.gameState.gameOver) {
        return 'finished';
    }

    return 'playing';
}

function buildLobbyPayload() {
    const list = [];

    for (let id = 1; id <= MAX_ROOMS; id += 1) {
        const room = rooms.get(id);
        const players = getPlayerSlots(room);

        list.push({
            id,
            status: getRoomStatus(room),
            playerCount: players.playerCount,
            spectatorCount: room.clients.size - players.playerCount
        });
    }

    return {
        type: 'lobby',
        rooms: list,
        maxRooms: MAX_ROOMS
    };
}

function buildStatePayload(room, roomId) {
    return {
        type: 'state',
        roomId,
        board: room.gameState.board,
        currentPlayer: room.gameState.currentPlayer,
        gameOver: room.gameState.gameOver,
        winner: room.gameState.winner,
        winLine: room.gameState.winLine,
        scores: room.scores,
        players: getPlayerSlots(room)
    };
}

function send(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function broadcastLobby() {
    const message = JSON.stringify(buildLobbyPayload());

    clients.forEach((_, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

function broadcastRoomState(roomId) {
    const room = rooms.get(roomId);
    const message = JSON.stringify(buildStatePayload(room, roomId));

    room.clients.forEach((_, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

function broadcastRoomJoinInfo(roomId) {
    const room = rooms.get(roomId);

    room.clients.forEach((client, ws) => {
        send(ws, {
            type: 'joined',
            roomId,
            symbol: client.symbol,
            role: client.symbol ? 'player' : 'spectator'
        });
    });
}

function leaveRoom(ws) {
    const client = clients.get(ws);

    if (!client?.roomId) {
        return;
    }

    const roomId = client.roomId;
    const room = rooms.get(roomId);

    room.clients.delete(ws);
    client.roomId = null;
    client.symbol = null;
    client.role = 'lobby';

    send(ws, { type: 'leftRoom' });
    broadcastRoomJoinInfo(roomId);
    broadcastRoomState(roomId);
    broadcastLobby();

    console.log(`Cliente salió de Sala ${roomId}`);
}

function joinRoom(ws, roomId) {
    const id = Number(roomId);

    if (Number.isNaN(id) || id < 1 || id > MAX_ROOMS) {
        send(ws, { type: 'error', message: 'Sala inválida' });
        return;
    }

    const client = clients.get(ws);

    if (client.roomId === id) {
        return;
    }

    if (client.roomId) {
        leaveRoom(ws);
    }

    const room = rooms.get(id);
    const symbol = assignSymbol(room);
    const role = symbol ? 'player' : 'spectator';

    room.clients.set(ws, { symbol });
    client.roomId = id;
    client.symbol = symbol;
    client.role = role;

    const roleLabel = symbol
        ? `Jugador ${symbol}`
        : 'Espectador';

    console.log(`Cliente entró a Sala ${id} (${roleLabel})`);

    send(ws, {
        type: 'joined',
        roomId: id,
        symbol,
        role
    });

    send(ws, buildStatePayload(room, id));
    broadcastRoomJoinInfo(id);
    broadcastRoomState(id);
    broadcastLobby();
}

wss.on('connection', (ws) => {
    clients.set(ws, {
        roomId: null,
        symbol: null,
        role: 'lobby'
    });

    console.log('Cliente conectado (lobby)');

    send(ws, buildLobbyPayload());

    ws.on('message', (message) => {
        let data;

        try {
            data = JSON.parse(message.toString());
        } catch {
            return;
        }

        const client = clients.get(ws);

        if (data.type === 'joinRoom') {
            joinRoom(ws, data.roomId);
            return;
        }

        if (data.type === 'leaveRoom') {
            leaveRoom(ws);
            return;
        }

        if (!client?.roomId) {
            return;
        }

        const room = rooms.get(client.roomId);

        if (data.type === 'reset') {
            room.gameState = createEmptyGameState();
            broadcastRoomState(client.roomId);
            broadcastLobby();
            return;
        }

        if (data.type !== 'move') {
            return;
        }

        if (!client.symbol) {
            return;
        }

        if (room.gameState.gameOver) {
            return;
        }

        if (client.symbol !== room.gameState.currentPlayer) {
            return;
        }

        const index = Number(data.index);

        if (
            Number.isNaN(index) ||
            index < 0 ||
            index > 8 ||
            room.gameState.board[index] !== ''
        ) {
            return;
        }

        room.gameState.board[index] = client.symbol;

        const result = checkWinner(room.gameState.board);

        if (result.winner) {
            room.gameState.gameOver = true;
            room.gameState.winner = result.winner;
            room.gameState.winLine = result.winLine;

            if (result.winner === 'draw') {
                room.scores.draws += 1;
            } else if (result.winner === 'X') {
                room.scores.x += 1;
            } else {
                room.scores.o += 1;
            }
        } else {
            room.gameState.currentPlayer =
                room.gameState.currentPlayer === 'X' ? 'O' : 'X';
        }

        broadcastRoomState(client.roomId);
        broadcastLobby();
    });

    ws.on('close', () => {
        leaveRoom(ws);
        clients.delete(ws);
        console.log('Cliente desconectado');
        broadcastLobby();
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('Servidor iniciado');
    console.log(`http://localhost:${PORT}`);
    console.log(`Salas disponibles: ${MAX_ROOMS}`);
});
