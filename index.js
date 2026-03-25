
// index.js (Node.js Backend)

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3500;

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cards';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected successfully.');
        seedCards();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// --- Card Schema and Model ---
const cardSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String, default: 'https://placehold.co/100x150/000000/FFFFFF?text=Ben10' },
    parameters: {
        height: { type: Number, required: true },
        power: { type: Number, required: true },
        speed: { type: Number, required: true },
        strength: { type: Number, required: true },
        intelligence: { type: Number, required: true },
        durability: { type: Number, required: true },
    }
});

const Card = mongoose.model('Card', cardSchema);

// --- Score Schema (Task 5: Highscores) ---
const scoreSchema = new mongoose.Schema({
    username: { type: String, required: true },
    avatar: { type: String, default: '' },
    wins: { type: Number, default: 0 },
    tricksWon: { type: Number, default: 0 },
    cardsCollected: { type: Number, default: 0 },
    gameType: { type: String, enum: ['multiplayer', 'friends'], default: 'multiplayer' },
    playedAt: { type: Date, default: Date.now },
});
const Score = mongoose.model('Score', scoreSchema);

// --- Seed Cards ---
async function seedCards() {
    try {
        const cardCount = await Card.countDocuments();
        if (cardCount === 0) {
            console.log('No cards found in DB. Seeding all cards from data.json...');
            const fs = require('fs');
            const dataPath = path.join(__dirname, 'data.json');
            
            if (fs.existsSync(dataPath)) {
                const sampleCards = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
                await Card.insertMany(sampleCards);
                console.log(`Successfully seeded ${sampleCards.length} Ben 10 cards!`);
            } else {
                console.log('Error: data.json not found preventing database seeding.');
            }
        }
    } catch (error) {
        console.error('Error seeding cards:', error);
    }
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- API Routes ---
// GET /api/leaderboard — top 10 by wins (multiplayer only)
app.get('/api/leaderboard', async (req, res) => {
    try {
        const filter = req.query.filter || 'wins';          // wins | tricksWon | cardsCollected
        const allowed = ['wins', 'tricksWon', 'cardsCollected'];
        const sortKey = allowed.includes(filter) ? filter : 'wins';
        const scores = await Score.find({ gameType: 'multiplayer' })
            .sort({ [sortKey]: -1 })
            .limit(10)
            .lean();
        res.json({ scores });
    } catch (e) {
        res.json({ scores: [] });
    }
});

// GET /api/rooms — active room count for landing page
app.get('/api/rooms', (req, res) => {
    res.json({ active: Object.keys(rooms).length });
});

// GET /game — serve the game page (lobby + game screen)
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// GET / — serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// --- Game Data Structures ---
// rooms[roomCode] = {
//   players, deck, playedCards, currentParameter, currentPlayerIndex,
//   hostId, gameStarted, roundWinner, trickCount, roundCount,
//   cardsPerPlayer, availableParameters, gameStartTime,
//   gameType: 'friends' | 'multiplayer'
// }
const rooms = {};

// --- Matchmaking Queue (Task 4) ---
// Each entry: { socketId, username, avatar, timer }
const matchmakingQueue = [];
const MATCH_CARDS = 10;   // fixed 10 cards in multiplayer
const MATCH_MAX_WAIT = 30;   // seconds
const MATCH_MIN_SIZE = 2;
const MATCH_MAX_SIZE = 5;

function broadcastQueueCount() {
    matchmakingQueue.forEach(e => {
        const s = io.sockets.sockets.get(e.socketId);
        if (s) s.emit('queueUpdate', { count: matchmakingQueue.length });
    });
}

async function tryMatch() {
    if (matchmakingQueue.length < MATCH_MIN_SIZE) return;

    // Take up to 5 players
    const group = matchmakingQueue.splice(0, Math.min(MATCH_MAX_SIZE, matchmakingQueue.length));
    broadcastQueueCount();

    // Clear any pending wait timers for these players
    group.forEach(e => clearTimeout(e.timer));

    // Create room
    const roomCode = generateRoomCode();
    const hostEntry = group[0];
    rooms[roomCode] = {
        players: group.map((e, i) => ({
            id: e.socketId, username: e.username, deck: [], currentCard: null,
            isHost: i === 0, handSize: 0, avatar: e.avatar,
            eliminated: false, spectating: false
        })),
        deck: [], playedCards: [], currentParameter: null,
        currentPlayerIndex: 0, hostId: hostEntry.socketId,
        gameStarted: false, roundWinner: null, trickCount: {}, roundCount: 0,
        gameStartTime: null, cardsPerPlayer: MATCH_CARDS,
        availableParameters: ['height', 'power', 'speed', 'strength', 'intelligence', 'durability'],
        gameType: 'multiplayer',
    };

    // Join each socket to the room
    for (const e of group) {
        const s = io.sockets.sockets.get(e.socketId);
        if (s) {
            s.join(roomCode);
            s.emit('matchmade', { roomCode, username: e.username, avatar: e.avatar, isHost: e.socketId === hostEntry.socketId });
        }
    }

    // Brief countdown then auto-start
    let countdown = 5;
    const tick = setInterval(() => {
        io.to(roomCode).emit('matchCountdown', { seconds: countdown });
        countdown--;
        if (countdown < 0) {
            clearInterval(tick);
            // Auto-start the game
            startMatchGame(roomCode);
        }
    }, 1000);
}

async function startMatchGame(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    room.gameStarted = true;
    room.deck = shuffleDeck(await createDeck());
    room.playedCards = [];
    room.currentPlayerIndex = 0;
    room.trickCount = {};
    room.roundCount = 0;
    room.currentParameter = null;
    room.gameStartTime = new Date();
    room.players.forEach(p => { p.eliminated = false; p.spectating = false; room.trickCount[p.id] = 0; });

    room.players.forEach(player => {
        player.deck = room.deck.splice(0, room.cardsPerPlayer);
        player.currentCard = player.deck.shift();
        player.handSize = player.deck.length + (player.currentCard ? 1 : 0);
    });

    room.players.forEach(player => {
        io.to(player.id).emit('gameStarted', {
            currentCard: player.currentCard,
            handSize: player.handSize,
            currentPlayerId: room.players[room.currentPlayerIndex].id,
            currentPlayerName: room.players[room.currentPlayerIndex].username,
            playersInRoom: buildPlayersInfo(room),
            currentParameter: room.currentParameter,
            availableParameters: room.availableParameters,
            gameType: 'multiplayer',
        });
    });
    io.to(roomCode).emit('updateGame', {
        playedCards: [],
        currentPlayerId: room.players[room.currentPlayerIndex].id,
        currentPlayerName: room.players[room.currentPlayerIndex].username,
        playersInRoom: buildPlayersInfo(room),
        currentParameter: null,
        availableParameters: room.availableParameters,
    });
    console.log(`[MATCH] Multiplayer game started in ${roomCode} with ${room.players.length} players.`);
}

// Predefined avatars
const avatars = [
    'https://placehold.co/50x50/FF6347/FFFFFF?text=A1',
    'https://placehold.co/50x50/4682B4/FFFFFF?text=A2',
    'https://placehold.co/50x50/32CD32/FFFFFF?text=A3',
    'https://placehold.co/50x50/FFD700/000000?text=A4',
    'https://placehold.co/50x50/8A2BE2/FFFFFF?text=A5',
    'https://placehold.co/50x50/FF4500/FFFFFF?text=A6',
    'https://placehold.co/50x50/1E90FF/FFFFFF?text=A7',
    'https://placehold.co/50x50/DAA520/FFFFFF?text=A8',
];

// --- Helper Functions ---
function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (rooms[code]);
    return code;
}

async function createDeck() {
    try {
        const cards = await Card.find({});
        if (cards.length === 0) {
            console.warn('No cards found in the database.');
            return [];
        }
        return cards.map(card => card.toObject());
    } catch (error) {
        console.error('Error fetching cards from DB:', error);
        return [];
    }
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function determineTrickWinner(playedCards, currentParameter) {
    if (playedCards.length === 0 || !currentParameter) return null;
    let winningCardEntry = playedCards[0];
    let highestValue = playedCards[0].card.parameters[currentParameter];
    for (let i = 1; i < playedCards.length; i++) {
        const cur = playedCards[i];
        const val = cur.card.parameters[currentParameter];
        if (val > highestValue) {
            highestValue = val;
            winningCardEntry = cur;
        }
    }
    return winningCardEntry;
}

// Returns players still in the game (not eliminated)
function activePlayers(room) {
    return room.players.filter(p => !p.eliminated);
}

// Build the playersInRoom array sent to clients
function buildPlayersInfo(room) {
    return room.players.map(p => ({
        id: p.id,
        username: p.username,
        handSize: p.handSize,
        avatar: p.avatar,
        eliminated: p.eliminated || false,
        spectating: p.spectating || false,
    }));
}

// ── resolveRound: resolve a completed trick ──────────────────────────
// Extracted so both manual plays AND auto-plays can trigger it
function resolveRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    clearTimeout(room.autoPlayTimer);

    const winnerEntry = determineTrickWinner(room.playedCards, room.currentParameter);
    if (!winnerEntry) return;
    const winnerPlayer = room.players.find(p => p.id === winnerEntry.playerId);
    room.roundWinner = winnerEntry.playerId;
    room.trickCount[winnerEntry.playerId] = (room.trickCount[winnerEntry.playerId] || 0) + 1;
    room.roundCount++;

    const cardsWon = room.playedCards.map(pc => pc.card);
    winnerPlayer.deck.push(...cardsWon);

    room.players.forEach(p => {
        if (!p.eliminated) {
            p.handSize = p.id === winnerPlayer.id ? p.deck.length : p.deck.length;
        }
    });

    console.log(`[TRICK] Won by ${winnerEntry.playerName} (${room.currentParameter}: ${winnerEntry.card.parameters[room.currentParameter]}). +${cardsWon.length} cards.`);

    io.to(roomCode).emit('updateGame', {
        playedCards: room.playedCards,
        currentPlayerId: winnerEntry.playerId,
        currentPlayerName: winnerEntry.playerName,
        playersInRoom: buildPlayersInfo(room),
        currentParameter: room.currentParameter,
        availableParameters: room.availableParameters,
        trickWinnerId: winnerEntry.playerId,
        cardsWon: cardsWon.length,
    });

    setTimeout(() => {
        room.playedCards = [];
        room.currentParameter = null;

        room.players.forEach(p => {
            if (!p.eliminated) {
                p.currentCard = p.deck.shift() || null;
                p.handSize = p.deck.length + (p.currentCard ? 1 : 0);
                io.to(p.id).emit('drawCard', { currentCard: p.currentCard, handSize: p.handSize });
            }
        });

        const justEliminated = [];
        room.players.forEach(p => {
            if (!p.eliminated && p.handSize === 0) {
                p.eliminated = true;
                justEliminated.push(p);
            }
        });
        justEliminated.forEach(p => {
            io.to(p.id).emit('playerEliminated', { username: p.username });
            io.to(roomCode).emit('playerEliminatedBroadcast', { username: p.username, playerId: p.id });
        });

        const stillActive = activePlayers(room);
        if (stillActive.length <= 1) {
            const winner = stillActive[0] || room.players.reduce((best, p) =>
                (p.handSize > (best ? best.handSize : -1)) ? p : best, null);
            const standings = room.players.map(p => ({
                username: p.username, avatar: p.avatar,
                handSize: p.handSize, tricksWon: room.trickCount[p.id] || 0, eliminated: p.eliminated || false,
            })).sort((a, b) => b.handSize - a.handSize);
            const tot = new Date() - room.gameStartTime;
            io.to(roomCode).emit('gameOver', {
                winner: winner ? { username: winner.username, avatar: winner.avatar } : null,
                standings,
                totalTime: `${Math.floor(tot / 60000)}m ${((tot % 60000) / 1000).toFixed(0)}s`,
                numHands: room.roundCount,
            });
            // ── Task 5: Save highscore for multiplayer games only ──────
            if (room.gameType === 'multiplayer' && winner) {
                const winnerTricks = room.trickCount[winner.id] || 0;
                const winnerCards = winner.handSize;
                Score.create({
                    username: winner.username,
                    avatar: winner.avatar,
                    wins: 1,
                    tricksWon: winnerTricks,
                    cardsCollected: winnerCards,
                    gameType: 'multiplayer',
                }).catch(e => console.error('[Score] Save error:', e.message));
                console.log(`[Score] Saved win for ${winner.username} (tricks:${winnerTricks} cards:${winnerCards})`);
            }
            return;
        }

        room.currentPlayerIndex = room.players.findIndex(p => p.id === room.roundWinner && !p.eliminated);
        if (room.currentPlayerIndex === -1) room.currentPlayerIndex = room.players.findIndex(p => !p.eliminated);

        io.to(roomCode).emit('updateGame', {
            playedCards: [],
            currentPlayerId: room.players[room.currentPlayerIndex].id,
            currentPlayerName: room.players[room.currentPlayerIndex].username,
            playersInRoom: buildPlayersInfo(room),
            currentParameter: null,
            availableParameters: room.availableParameters,
            promptChooseParameter: true,
        });
    }, 2000);
}

// --- Socket.IO ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // ── Join Matchmaking Queue (Task 4) ─────────────────────────────
    socket.on('joinQueue', ({ username, avatar }) => {
        // Remove if already in queue
        const existing = matchmakingQueue.findIndex(e => e.socketId === socket.id);
        if (existing !== -1) matchmakingQueue.splice(existing, 1);

        const playerUsername = username || `Alien-${Math.floor(Math.random() * 9999)}`;
        const playerAvatar = avatar || avatars[Math.floor(Math.random() * avatars.length)];

        // 30s timeout: if still waiting alone after 30s, keep waiting (need at least 2)
        const timer = setTimeout(() => {
            const idx = matchmakingQueue.findIndex(e => e.socketId === socket.id);
            if (idx !== -1 && matchmakingQueue.length >= MATCH_MIN_SIZE) tryMatch();
        }, MATCH_MAX_WAIT * 1000);

        matchmakingQueue.push({ socketId: socket.id, username: playerUsername, avatar: playerAvatar, timer });
        broadcastQueueCount();
        console.log(`[Queue] ${playerUsername} joined. Queue size: ${matchmakingQueue.length}`);

        if (matchmakingQueue.length >= MATCH_MIN_SIZE) {
            // Give a short window (3s) for more players to queue up before matching
            setTimeout(tryMatch, 3000);
        }
    });

    socket.on('leaveQueue', () => {
        const idx = matchmakingQueue.findIndex(e => e.socketId === socket.id);
        if (idx !== -1) {
            clearTimeout(matchmakingQueue[idx].timer);
            matchmakingQueue.splice(idx, 1);
            broadcastQueueCount();
            console.log(`[Queue] Player left queue. Queue size: ${matchmakingQueue.length}`);
        }
    });


    // ── Create Room ──────────────────────────────────────────────────
    socket.on('createRoom', ({ username, avatar }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, username, deck: [], currentCard: null, isHost: true, handSize: 0, avatar: avatar || avatars[0], eliminated: false, spectating: false }],
            deck: [],
            playedCards: [],
            currentParameter: null,
            currentPlayerIndex: 0,
            hostId: socket.id,
            gameStarted: false,
            roundWinner: null,
            trickCount: {},
            roundCount: 0,
            gameStartTime: null,
            cardsPerPlayer: 10,
            availableParameters: ['height', 'power', 'speed', 'strength', 'intelligence', 'durability'],
            gameType: 'friends',
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updateLobby', rooms[roomCode].players.map(p => ({ username: p.username, isHost: p.isHost, avatar: p.avatar })));
        console.log(`Room ${roomCode} created by ${username}`);
    });

    // ── Join Room ─────────────────────────────────────────────────────
    socket.on('joinRoom', ({ roomCode, username, avatar }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];
        if (!room) { socket.emit('errorMessage', 'Room not found.'); return; }
        if (room.gameStarted) { socket.emit('errorMessage', 'Cannot join, game already started.'); return; }
        if (room.players.length >= 5) { socket.emit('errorMessage', 'Room is full (max 5 players).'); return; }

        const playerUsername = username || `Guest-${Math.floor(Math.random() * 1000)}`;
        const playerAvatar = avatar || avatars[Math.floor(Math.random() * avatars.length)];

        room.players.push({ id: socket.id, username: playerUsername, deck: [], currentCard: null, isHost: false, handSize: 0, avatar: playerAvatar, eliminated: false, spectating: false });
        socket.join(roomCode);
        socket.emit('roomJoined', { roomCode, username: playerUsername, avatar: playerAvatar });
        io.to(roomCode).emit('updateLobby', room.players.map(p => ({ username: p.username, isHost: p.isHost, avatar: p.avatar })));
        console.log(`${playerUsername} joined room ${roomCode}`);
    });

    // ── Set Cards Per Player ──────────────────────────────────────────
    socket.on('setCardsPerPlayer', ({ roomCode, cardsPerPlayer }) => {
        const room = rooms[roomCode];
        if (!room || socket.id !== room.hostId) { socket.emit('errorMessage', 'Only the host can set card count.'); return; }
        room.cardsPerPlayer = cardsPerPlayer;
        io.to(roomCode).emit('lobbySettingUpdate', { cardsPerPlayer: room.cardsPerPlayer });
    });

    // ── Start Game ────────────────────────────────────────────────────
    socket.on('startGame', async ({ roomCode, cardsPerPlayer }) => {
        const room = rooms[roomCode];
        if (!room || socket.id !== room.hostId) { socket.emit('errorMessage', 'Only the host can start the game.'); return; }
        if (room.players.length < 2) { socket.emit('errorMessage', 'Need at least 2 players.'); return; }

        room.cardsPerPlayer = cardsPerPlayer || room.cardsPerPlayer;
        room.gameStarted = true;
        room.deck = shuffleDeck(await createDeck());
        room.playedCards = [];
        room.currentPlayerIndex = 0;
        room.trickCount = {};
        room.roundCount = 0;
        room.currentParameter = null;
        room.gameStartTime = new Date();
        room.players.forEach(p => { p.eliminated = false; p.spectating = false; room.trickCount[p.id] = 0; });

        // Deal cards
        room.players.forEach(player => {
            player.deck = room.deck.splice(0, room.cardsPerPlayer);
            player.currentCard = player.deck.shift();
            player.handSize = player.deck.length + (player.currentCard ? 1 : 0);
        });

        // Send individual gameStarted events
        room.players.forEach(player => {
            io.to(player.id).emit('gameStarted', {
                currentCard: player.currentCard,
                handSize: player.handSize,
                currentPlayerId: room.players[room.currentPlayerIndex].id,
                currentPlayerName: room.players[room.currentPlayerIndex].username,
                playersInRoom: buildPlayersInfo(room),
                currentParameter: room.currentParameter,
                availableParameters: room.availableParameters
            });
        });

        io.to(roomCode).emit('updateGame', {
            playedCards: room.playedCards,
            currentPlayerId: room.players[room.currentPlayerIndex].id,
            currentPlayerName: room.players[room.currentPlayerIndex].username,
            playersInRoom: buildPlayersInfo(room),
            currentParameter: room.currentParameter,
            availableParameters: room.availableParameters
        });

        console.log(`Game started in room ${roomCode}.`);
    });

    // ── Play Card ─────────────────────────────────────────────────────
    socket.on('playCard', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || !room.gameStarted) { socket.emit('errorMessage', 'Game not started.'); return; }

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.eliminated) { socket.emit('errorMessage', 'You are not an active player.'); return; }
        if (socket.id !== room.players[room.currentPlayerIndex].id) { socket.emit('errorMessage', "It's not your turn!"); return; }
        if (!player.currentCard) { socket.emit('errorMessage', 'You have no card to play.'); return; }

        // First card of trick: must have a parameter chosen
        if (room.playedCards.length === 0 && !room.currentParameter) {
            socket.emit('errorMessage', 'You must choose a parameter before playing.');
            return;
        }

        const playedCard = player.currentCard;
        // Clear any pending auto-play timer since this player acted manually
        clearTimeout(room.autoPlayTimer);
        // ── FIX: Do NOT draw next card yet. Clear currentCard until trick resolves.
        player.currentCard = null;
        // handSize stays the same until trick resolves (card is "in play")
        room.playedCards.push({ playerId: socket.id, card: playedCard, playerName: player.username });

        // Tell this player their card is "in play"
        io.to(socket.id).emit('cardPlayed', {
            card: playedCard,
            playerId: socket.id,
            currentCard: null,
            handSize: player.handSize
        });

        const active = activePlayers(room);
        const activeThatPlayed = room.playedCards.filter(pc => active.find(p => p.id === pc.playerId));
        if (activeThatPlayed.length === active.length) {
            resolveRound(roomCode);

        } else {
            // ── Not all played yet: advance to next active player ──────────
            let nextIdx = (room.currentPlayerIndex + 1) % room.players.length;
            while (room.players[nextIdx].eliminated) {
                nextIdx = (nextIdx + 1) % room.players.length;
            }
            room.currentPlayerIndex = nextIdx;
            const nextPlayer = room.players[room.currentPlayerIndex];

            io.to(roomCode).emit('updateGame', {
                playedCards: room.playedCards,
                currentPlayerId: nextPlayer.id,
                currentPlayerName: nextPlayer.username,
                playersInRoom: buildPlayersInfo(room),
                currentParameter: room.currentParameter,
                availableParameters: room.availableParameters,
            });

            // ── Auto-play: if parameter already set, auto-play in 5s ─────
            if (room.currentParameter) {
                clearTimeout(room.autoPlayTimer);
                room.autoPlayTimer = setTimeout(() => {
                    const p = room.players[room.currentPlayerIndex];
                    if (!p || p.eliminated || !p.currentCard) return;
                    // Only auto-play if parameter is still set (trick still active)
                    if (!room.currentParameter) return;
                    // Check player hasn't already played this round
                    const alreadyPlayed = room.playedCards.find(pc => pc.playerId === p.id);
                    if (alreadyPlayed) return;

                    console.log(`[AUTO-PLAY] ${p.username} auto-played after 5s`);
                    const playedCard = p.currentCard;
                    p.currentCard = null;
                    room.playedCards.push({ playerId: p.id, card: playedCard, playerName: p.username });

                    // Notify room of the auto-play
                    io.to(roomCode).emit('autoPlayed', { playerId: p.id, playerName: p.username });

                    // Emit playCard acknowledgement to the player
                    io.to(p.id).emit('cardPlayed', { card: playedCard, playerId: p.id, handSize: p.handSize });

                    // Emit server-side playCard logic (re-use playCard handler logic)
                    const activePlayed = room.playedCards.filter(pc => activePlayers(room).find(ap => ap.id === pc.playerId));
                    if (activePlayed.length === activePlayers(room).length) {
                        // Trick complete — resolve it
                        resolveRound(roomCode);
                    } else {
                        // Still waiting on more players — advance turn again
                        let nIdx = (room.currentPlayerIndex + 1) % room.players.length;
                        while (room.players[nIdx].eliminated) nIdx = (nIdx + 1) % room.players.length;
                        room.currentPlayerIndex = nIdx;
                        const nPlayer = room.players[room.currentPlayerIndex];

                        io.to(roomCode).emit('updateGame', {
                            playedCards: room.playedCards,
                            currentPlayerId: nPlayer.id,
                            currentPlayerName: nPlayer.username,
                            playersInRoom: buildPlayersInfo(room),
                            currentParameter: room.currentParameter,
                            availableParameters: room.availableParameters,
                        });

                        // Recurse: start another auto-play timer for next player
                        if (room.currentParameter) {
                            clearTimeout(room.autoPlayTimer);
                            room.autoPlayTimer = setTimeout(() => {
                                const ap = room.players[room.currentPlayerIndex];
                                if (!ap || ap.eliminated || !ap.currentCard) return;
                                if (room.playedCards.find(pc => pc.playerId === ap.id)) return;
                                // Emit a playCard event on behalf of this player
                                console.log(`[AUTO-PLAY-2] ${ap.username} auto-played`);
                                const aCard = ap.currentCard;
                                ap.currentCard = null;
                                room.playedCards.push({ playerId: ap.id, card: aCard, playerName: ap.username });
                                io.to(roomCode).emit('autoPlayed', { playerId: ap.id, playerName: ap.username });
                                io.to(ap.id).emit('cardPlayed', { card: aCard, playerId: ap.id, handSize: ap.handSize });
                                const ap2 = room.playedCards.filter(pc => activePlayers(room).find(x => x.id === pc.playerId));
                                if (ap2.length === activePlayers(room).length) resolveRound(roomCode);
                            }, 5000);
                        }
                    }
                }, 5000);

                // Broadcast countdown to all clients
                io.to(roomCode).emit('autoPlayCountdown', { seconds: 5 });
            }
        }
    });

    // ── Choose Parameter ──────────────────────────────────────────────
    socket.on('chooseParameter', ({ roomCode, parameter }) => {
        const room = rooms[roomCode];
        if (!room || !room.gameStarted) { socket.emit('errorMessage', 'Game not started.'); return; }
        if (socket.id !== room.players[room.currentPlayerIndex].id) { socket.emit('errorMessage', "It's not your turn to choose!"); return; }
        if (!room.availableParameters.includes(parameter)) { socket.emit('errorMessage', 'Invalid parameter.'); return; }

        room.currentParameter = parameter;
        console.log(`${room.players[room.currentPlayerIndex].username} chose parameter: ${parameter}`);

        io.to(roomCode).emit('updateGame', {
            playedCards: room.playedCards,
            currentPlayerId: room.players[room.currentPlayerIndex].id,
            currentPlayerName: room.players[room.currentPlayerIndex].username,
            playersInRoom: buildPlayersInfo(room),
            currentParameter: room.currentParameter,
            availableParameters: room.availableParameters,
            promptChooseParameter: false,
        });
    });

    // ── Chat Message ──────────────────────────────────────────────────
    socket.on('chatMessage', ({ roomCode, username, message }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        const sanitized = String(message).trim().slice(0, 120);
        if (!sanitized) return;
        io.to(roomCode).emit('chatMessage', {
            username: player.username,
            avatar: player.avatar,
            message: sanitized,
            timestamp: Date.now(),
        });
    });

    // ── Spectate Game ─────────────────────────────────────────────────
    socket.on('spectateGame', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.eliminated) return;

        player.spectating = true;
        console.log(`${player.username} is now spectating room ${roomCode}`);

        // Send current game state to the spectator
        const active = activePlayers(room);
        io.to(socket.id).emit('spectatorJoined', {
            playersInRoom: buildPlayersInfo(room),
            currentPlayerId: active.length > 0 ? room.players[room.currentPlayerIndex].id : null,
            currentPlayerName: active.length > 0 ? room.players[room.currentPlayerIndex].username : '',
            playedCards: room.playedCards,
            currentParameter: room.currentParameter,
            availableParameters: room.availableParameters,
        });
    });

    // ── Replay Game ───────────────────────────────────────────────────
    socket.on('replayGame', async ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || socket.id !== room.hostId) { socket.emit('errorMessage', 'Only the host can replay.'); return; }
        if (room.players.length < 2) { socket.emit('errorMessage', 'Need at least 2 players.'); return; }

        room.gameStarted = true;
        room.playedCards = [];
        room.currentPlayerIndex = 0;
        room.trickCount = {};
        room.roundCount = 0;
        room.currentParameter = null;
        room.gameStartTime = new Date();
        room.players.forEach(p => {
            p.eliminated = false;
            p.spectating = false;
            p.deck = [];
            p.currentCard = null;
            p.handSize = 0;
            room.trickCount[p.id] = 0;
        });

        room.deck = shuffleDeck(await createDeck());
        room.players.forEach(player => {
            player.deck = room.deck.splice(0, room.cardsPerPlayer);
            player.currentCard = player.deck.shift();
            player.handSize = player.deck.length + (player.currentCard ? 1 : 0);
        });

        room.players.forEach(player => {
            io.to(player.id).emit('gameStarted', {
                currentCard: player.currentCard,
                handSize: player.handSize,
                currentPlayerId: room.players[room.currentPlayerIndex].id,
                currentPlayerName: room.players[room.currentPlayerIndex].username,
                playersInRoom: buildPlayersInfo(room),
                currentParameter: room.currentParameter,
                availableParameters: room.availableParameters,
            });
        });
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove from matchmaking queue if present
        const qi = matchmakingQueue.findIndex(e => e.socketId === socket.id);
        if (qi !== -1) {
            clearTimeout(matchmakingQueue[qi].timer);
            matchmakingQueue.splice(qi, 1);
            broadcastQueueCount();
        }
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex === -1) continue;

            const disconnectedPlayer = room.players.splice(playerIndex, 1)[0];
            io.to(roomCode).emit('playerLeft', disconnectedPlayer.username);
            console.log(`${disconnectedPlayer.username} left room ${roomCode}`);

            if (room.players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted.`);
            } else {
                if (disconnectedPlayer.id === room.hostId) {
                    room.hostId = room.players[0].id;
                    room.players[0].isHost = true;
                }
                if (room.gameStarted && room.currentPlayerIndex >= room.players.length) {
                    room.currentPlayerIndex = 0;
                }
                if (!room.gameStarted) {
                    io.to(roomCode).emit('updateLobby', room.players.map(p => ({ username: p.username, isHost: p.isHost, avatar: p.avatar })));
                } else {
                    const active = activePlayers(room);
                    if (active.length <= 1) {
                        // End game
                        const winner = active[0];
                        io.to(roomCode).emit('gameOver', {
                            winner: winner ? { username: winner.username, avatar: winner.avatar } : null,
                            standings: room.players.map(p => ({ username: p.username, avatar: p.avatar, handSize: p.handSize, tricksWon: room.trickCount[p.id] || 0 })),
                            totalTime: '—',
                            numHands: room.roundCount,
                        });
                    } else {
                        if (room.currentPlayerIndex >= room.players.length) room.currentPlayerIndex = 0;
                        io.to(roomCode).emit('updateGame', {
                            playedCards: room.playedCards,
                            currentPlayerId: room.players[room.currentPlayerIndex].id,
                            currentPlayerName: room.players[room.currentPlayerIndex].username,
                            playersInRoom: buildPlayersInfo(room),
                            currentParameter: room.currentParameter,
                            availableParameters: room.availableParameters,
                        });
                    }
                }
            }
            break;
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
