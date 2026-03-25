// ══════════════════════════════════════════
//  SOCKET + STATE
// ══════════════════════════════════════════
const socket = io();

let username = '', roomCode = '', isHost = false, myAvatar = '';
let playerCurrentCard = null, playerDeckSize = 0;
let selectedCard = null, selectedCardData = null, selectedParameter = null;
let currentPlayerId = null, myPlayerId = null;
let availableParameters = [];
let trickCount = 0, roundCount = 0;

// ══════════════════════════════════════════
//  DOM REFS & INIT LOAD
// ══════════════════════════════════════════
const $ = id => document.getElementById(id);
const welcomeScreen = $('welcome-screen');
const lobbyScreen = $('lobby-screen');
const gameScreen = $('game-screen');
const resultsOverlay = $('results-overlay');
const usernameInput = $('username-input');

// Autoload Username if returning player added on 2503
if (usernameInput) {
    const savedName = localStorage.getItem('ben10_username');
    if (savedName) usernameInput.value = savedName;
}

const createRoomBtn = $('create-room-btn');
const roomCodeInput = $('room-code-input');
const joinRoomBtn = $('join-room-btn');
const lobbyRoomCode = $('lobby-room-code');
const myUsernameSpan = $('my-username');
const myAvatarImg = $('my-avatar');
const playersList = $('players-list');
const playerCountSpan = $('player-count');
const startGameBtn = $('start-game-btn');
const startGameMessage = $('start-game-message');
const hostMessage = $('host-message');
const playerCardArea = $('player-current-card-area');
const deckCountMini = $('deck-count-mini');
const playCardBtn = $('play-card-btn');
const currentParamName = $('current-parameter-name');
const currentTurnText = $('current-turn-text');
const avatarQuickGrid = $('avatar-quick-grid');
const avatarDropdownToggle = $('avatar-dropdown-toggle');
const avatarArrow = $('avatar-arrow');
const avatarExpandedContainer = $('avatar-expanded-container');
const cardsPerPlayerSel = $('cards-per-player');
const cardCountSelDiv = $('card-count-selection');
const resultsContent = $('results-content');
const homeBtn = $('home-btn');
const replayBtn = $('replay-btn');
const copyRoomCodeBtn = $('copy-room-code-btn');
const messageBox = $('message-box');
const messageText = $('message-text');
const messageOkBtn = $('message-ok-button');
const mPlayBtn = $('m-play-btn');
const mPlayerCardArea = $('m-player-card-area');
const mDeckCount = $('m-deck-count');
const chatMsgsEl = $('chat-msgs');
const chatInEl = $('chat-in');
const mChatMsgsEl = $('m-chat-msgs');
const mChatInEl = $('m-chat-in');

const avatarCategories = {
    "Ben 10 Robots": [
        'https://api.dicebear.com/7.x/bottts/svg?seed=Omnitrix&backgroundColor=09e27d',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Heatblast&backgroundColor=f53906',
        'https://api.dicebear.com/7.x/bottts/svg?seed=XLR8&backgroundColor=1b96e9',
        'https://api.dicebear.com/7.x/bottts/svg?seed=FourArms&backgroundColor=c82323',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Diamondhead&backgroundColor=7beddb',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Upgrade&backgroundColor=06a857',
        'https://api.dicebear.com/7.x/bottts/svg?seed=GreyMatter&backgroundColor=a8a8a8',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Wildmutt&backgroundColor=f0921a',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Ghostfreak&backgroundColor=6b6b6b',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Ripjaws&backgroundColor=2859b3'
    ],
    "Classic Alphabetic": [
        'https://placehold.co/60x60/FF6347/FFFFFF?text=A1',
        'https://placehold.co/60x60/4682B4/FFFFFF?text=A2',
        'https://placehold.co/60x60/32CD32/FFFFFF?text=A3',
        'https://placehold.co/60x60/FFD700/000000?text=A4',
        'https://placehold.co/60x60/8A2BE2/FFFFFF?text=A5',
        'https://placehold.co/60x60/FF4500/FFFFFF?text=A6',
        'https://placehold.co/60x60/1E90FF/FFFFFF?text=A7',
        'https://placehold.co/60x60/DAA520/FFFFFF?text=A8'
    ],
    "Alien Monsters": [
        'https://robohash.org/Alien1?set=set2&bgset=bg1',
        'https://robohash.org/Alien2?set=set2&bgset=bg1',
        'https://robohash.org/Alien3?set=set2&bgset=bg1',
        'https://robohash.org/Alien4?set=set2&bgset=bg1',
        'https://robohash.org/Alien5?set=set2&bgset=bg1',
        'https://robohash.org/Alien6?set=set2&bgset=bg1',
        'https://robohash.org/Alien7?set=set2&bgset=bg1',
        'https://robohash.org/Alien8?set=set2&bgset=bg1',
        'https://www.deviantart.com/powermaster17/art/Ultra-Ben-899596447',
        'https://www.deviantart.com/thehawkdown/art/Ben-10-Into-The-Omniverse-901952582',
        'https://ben10.fandom.com/wiki/Ultimate_Forms',
        'https://static.wikia.nocookie.net/ben10/images/3/34/UHUA.png/revision/latest?cb=20250415101531',
        'https://www.google.com/imgres?q=ben%2010%20avatars&imgurl=https%3A%2F%2Fw0.peakpx.com%2Fwallpaper%2F582%2F929%2FHD-wallpaper-ben-10-with-power-avatar-ben-10-power-avatar.jpg&imgrefurl=https%3A%2F%2Fwww.peakpx.com%2Fen%2Fhd-wallpaper-desktop-ebdwf&docid=FwAPotm8vUV9WM&tbnid=E6tBpFvqi5yDeM&vet=12ahUKEwi_lZPcu7mTAxVl2DgGHQwlMTIQnPAOegQILxAB..i&w=800&h=1422&hcb=2&ved=2ahUKEwi_lZPcu7mTAxVl2DgGHQwlMTIQnPAOegQILxAB'
    ],
    "Pixel Heroes": [
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Ben',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Gwen',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Max',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Kevin',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Vilgax',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Azmuth',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Tetrax',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Rook'
    ]
};

// ══════════════════════════════════════════
//  AVATAR INIT
// ══════════════════════════════════════════
function initAvatarSelection() {
    if (!avatarQuickGrid || !avatarExpandedContainer) return;

    avatarQuickGrid.innerHTML = '';
    avatarExpandedContainer.innerHTML = '';

    const allAvatarElements = [];

    function createAvatarImg(url) {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'avatar-option';
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            allAvatarElements.forEach(i => i.classList.remove('selected-avatar'));
            allAvatarElements.filter(i => i.src === url).forEach(i => i.classList.add('selected-avatar'));
            myAvatar = url;
            localStorage.setItem('ben10_avatar', myAvatar);
        });
        return img;
    }

    // Quick Grid (Top 8 Robots)
    avatarCategories["Ben 10 Robots"].slice(0, 8).forEach(url => {
        const img = createAvatarImg(url);
        avatarQuickGrid.appendChild(img);
        allAvatarElements.push(img);
    });

    // Expanded Container
    for (const [category, urls] of Object.entries(avatarCategories)) {
        const section = document.createElement('div');
        section.style.marginBottom = '12px';

        const title = document.createElement('div');
        title.textContent = category;
        title.style.fontFamily = "'Orbitron', monospace";
        title.style.fontSize = '0.65rem';
        title.style.color = 'var(--green)';
        title.style.marginBottom = '6px';
        title.style.textTransform = 'uppercase';
        title.style.letterSpacing = '1px';
        title.style.opacity = '0.8';

        const grid = document.createElement('div');
        grid.className = 'avatar-grid';
        grid.style.background = 'transparent';
        grid.style.padding = '0';

        urls.forEach(url => {
            const img = createAvatarImg(url);
            grid.appendChild(img);
            allAvatarElements.push(img);
        });

        section.appendChild(title);
        section.appendChild(grid);
        avatarExpandedContainer.appendChild(section);
    }

    // Default selection or load saved
    const savedAvatar = localStorage.getItem('ben10_avatar');
    const defUrl = savedAvatar || avatarCategories["Ben 10 Robots"][0];
    myAvatar = defUrl;
    allAvatarElements.filter(i => i.src === defUrl).forEach(i => i.classList.add('selected-avatar'));

    // Toggle Expand
    if (avatarDropdownToggle) {
        avatarDropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            avatarExpandedContainer.classList.toggle('hidden');
            if (avatarArrow) avatarArrow.textContent = avatarExpandedContainer.classList.contains('hidden') ? '▼' : '▲';
        });
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (avatarDropdownToggle && !avatarDropdownToggle.contains(e.target) && !avatarExpandedContainer.contains(e.target)) {
        avatarExpandedContainer.classList.add('hidden');
        if (avatarArrow) avatarArrow.textContent = '▼';
    }
});

// ══════════════════════════════════════════
//  MESSAGE BOX  (errors / room setup only)
// ══════════════════════════════════════════
function showMessageBox(msg) {
    messageText.textContent = msg;
    messageBox.classList.remove('hidden');
}

messageOkBtn.addEventListener('click', () => {
    messageBox.classList.add('hidden');
});

// ══════════════════════════════════════════
//  INLINE GAME NOTIFICATION (replaces popups)
// ══════════════════════════════════════════
let _gNotifTimer;
function showGameNotif(msg, type = 'info') {
    const el = $('game-notif'); if (!el) return;
    el.textContent = msg;
    el.className = 'show' + (type !== 'info' ? ' ' + type : '');
    clearTimeout(_gNotifTimer);
    // Auto-clear neutral messages after 4s; win/warn stay until next event
    if (type === 'info') _gNotifTimer = setTimeout(() => el.className = '', 4000);
}

// ══════════════════════════════════════════
//  CARD BUILDERS
// ══════════════════════════════════════════
function buildCardBack(eliminated = false) {
    const d = document.createElement('div');
    d.className = 'card-back';
    if (eliminated) {
        const badge = document.createElement('div');
        badge.className = 'elim-badge';
        badge.textContent = '💀 OUT';
        d.appendChild(badge);
    }
    return d;
}

function buildCard(card, isPlayable, isWinnerChoosing) {
    const d = document.createElement('div');
    d.className = 'pcard'; d.dataset.cardName = card.name;

    const bg = document.createElement('div');
    bg.className = 'pcard-bg';
    if (card.imageUrl) bg.style.backgroundImage = `url('${card.imageUrl}')`;
    d.appendChild(bg);

    const nm = document.createElement('div');
    nm.className = 'pcard-name'; nm.textContent = card.name; d.appendChild(nm);

    const ps = document.createElement('div'); ps.className = 'pcard-params';
    const params = availableParameters.length > 0 ? availableParameters : Object.keys(card.parameters);
    params.forEach(param => {
        const pp = document.createElement('div');
        pp.className = 'pp'; pp.dataset.param = param;
        pp.innerHTML = `<span class="pl">${param}</span><span class="pv">${card.parameters[param]}</span>`;
        if (isPlayable && isWinnerChoosing) {
            pp.addEventListener('click', e => { e.stopPropagation(); selectParameter(pp, param, d, card); });
        }
        ps.appendChild(pp);
    });
    d.appendChild(ps);

    if (isPlayable && !isWinnerChoosing) {
        d.addEventListener('click', () => selectCard(d, card));
    }
    return d;
}

function buildRevealedCard(card, currentParameter) {
    const d = document.createElement('div');
    d.className = 'pcard card-reveal'; d.style.cursor = 'default';

    const bg = document.createElement('div');
    bg.className = 'pcard-bg';
    if (card.imageUrl) bg.style.backgroundImage = `url('${card.imageUrl}')`;
    d.appendChild(bg);

    const nm = document.createElement('div');
    nm.className = 'pcard-name'; nm.textContent = card.name; d.appendChild(nm);

    const ps = document.createElement('div'); ps.className = 'pcard-params';
    const params = availableParameters.length > 0 ? availableParameters : Object.keys(card.parameters);
    params.forEach(param => {
        const pp = document.createElement('div');
        pp.className = 'pp' + (param === currentParameter ? ' active-param' : '');
        pp.innerHTML = `<span class="pl">${param}</span><span class="pv">${card.parameters[param]}</span>`;
        ps.appendChild(pp);
    });
    d.appendChild(ps);
    return d;
}

function selectCard(cardDiv, cardData) {
    if (selectedCard) selectedCard.classList.remove('selected');
    selectedCard = cardDiv; selectedCardData = cardData;
    selectedCard.classList.add('selected');
    playCardBtn.disabled = false; mPlayBtn.disabled = false;
}

function selectParameter(ppDiv, paramName, cardDiv, cardData) {
    cardDiv.querySelectorAll('.pp').forEach(p => p.classList.remove('selected-param'));
    ppDiv.classList.add('selected-param');
    selectedParameter = paramName;
    selectCard(cardDiv, cardData);
    const mCard = mPlayerCardArea.querySelector('.pcard');
    if (mCard) {
        mCard.querySelectorAll('.pp').forEach(p => {
            p.classList.toggle('selected-param', p.dataset.param === paramName);
        });
    }
    showGameNotif(`⚡ Stat selected: ${paramName.toUpperCase()} — now play your card!`, 'win');
}

// ══════════════════════════════════════════
//  RENDER PLAYER HAND + DECK
// ══════════════════════════════════════════
function renderPlayerHandAndDeck(currentCard, deckSize, isWinnerChoosing = false) {
    playerCardArea.innerHTML = ''; mPlayerCardArea.innerHTML = '';
    playerDeckSize = deckSize; playerCurrentCard = currentCard;
    selectedParameter = null;

    if (currentCard) {
        const dc = buildCard(currentCard, true, isWinnerChoosing);
        playerCardArea.appendChild(dc);
        selectCard(dc, currentCard);
        const mc = buildCard(currentCard, true, isWinnerChoosing);
        mc.style.height = '100%'; mc.style.margin = '0'; mc.style.maxHeight = 'none';
        mPlayerCardArea.appendChild(mc);
        mc.querySelectorAll('.pp').forEach(pp => {
            pp.addEventListener('click', e => {
                e.stopPropagation();
                const param = pp.dataset.param;
                dc.querySelectorAll('.pp').forEach(p => p.classList.remove('selected-param'));
                dc.querySelectorAll('.pp').forEach(p => { if (p.dataset.param === param) p.classList.add('selected-param'); });
                mc.querySelectorAll('.pp').forEach(p => p.classList.remove('selected-param'));
                pp.classList.add('selected-param');
                selectedParameter = param;
                selectCard(dc, currentCard);
                showGameNotif(`⚡ Stat: ${param.toUpperCase()} selected — play your card!`, 'win');
            });
        });
    } else {
        playerCardArea.innerHTML = '<p style="color:var(--txt-muted);font-size:0.85rem;font-style:italic">No cards left</p>';
        mPlayerCardArea.innerHTML = '<p style="color:var(--txt-muted);font-size:0.75rem;font-style:italic">No cards left</p>';
        selectedCard = null; playCardBtn.disabled = true; mPlayBtn.disabled = true;
    }

    deckCountMini.textContent = deckSize;
    mDeckCount.textContent = deckSize;
    $('footer-deck') && ($('footer-deck').textContent = deckSize + ' left');
}

// ══════════════════════════════════════════
//  RENDER OPPONENT SLOTS
// ══════════════════════════════════════════
function renderOpponentSlots(playersInRoom, myId, curPlayerId, playedCards, currentParameter) {
    const opponents = playersInRoom.filter(p => p.id !== myId);
    const rowTop = $('row-top');
    const slot4th = $('slot-4th-opp');
    const mOpp = $('m-opponents');

    rowTop.innerHTML = ''; mOpp.innerHTML = ''; slot4th.style.display = 'none';

    const playedMap = {};
    (playedCards || []).forEach(e => { playedMap[e.playerId] = e; });

    opponents.forEach((player, idx) => {
        const isActive = player.id === curPlayerId;
        const played = playedMap[player.id];
        const isBottom = idx === 3;
        const slotEl = isBottom ? slot4th : document.createElement('div');

        slotEl.className = 'slot';
        if (isActive) slotEl.classList.add('active-turn');
        else slotEl.classList.remove('active-turn');

        const bar = document.createElement('div'); bar.className = 'slot-bar';
        bar.innerHTML = `<img class="slot-av" src="${player.avatar}" alt=""><span class="slot-name">${player.username}</span><span class="slot-count">${player.handSize}</span>`;
        slotEl.appendChild(bar);

        const isElim = player.eliminated;
        if (played && !isElim) {
            slotEl.appendChild(buildRevealedCard(played.card, currentParameter));
        } else {
            slotEl.appendChild(buildCardBack(isElim));
        }

        if (isBottom) {
            slot4th.style.display = '';
            $('bottom-row-label').textContent = 'You & ' + player.username;
            $('row-bottom').style.gridTemplateColumns = '1fr 2fr';
        } else {
            rowTop.appendChild(slotEl);
        }

        const mSlot = document.createElement('div');
        mSlot.className = 'm-slot' + (isActive ? ' active-turn' : '');
        const mBar = document.createElement('div'); mBar.className = 'slot-bar';
        mBar.innerHTML = `<img class="slot-av" src="${player.avatar}" alt=""><span class="slot-name">${player.username}${isElim ? ' 💀' : ''}</span><span class="slot-count">${player.handSize}</span>`;
        mSlot.appendChild(mBar);
        if (played && !isElim) {
            mSlot.appendChild(buildRevealedCard(played.card, currentParameter));
        } else {
            mSlot.appendChild(buildCardBack(isElim));
        }
        mOpp.appendChild(mSlot);
    });

    if (opponents.length < 4) {
        $('row-bottom').style.gridTemplateColumns = '1fr';
        $('bottom-row-label').textContent = 'You';
    }

    while (rowTop.children.length < 3 && opponents.length < 3) {
        const empty = document.createElement('div');
        empty.className = 'slot';
        empty.style.opacity = '0.3';
        empty.innerHTML = '<div style="font-size:0.7rem;color:var(--txt-muted);font-style:italic">Empty</div>';
        rowTop.appendChild(empty);
    }
}

// ══════════════════════════════════════════
//  RENDER SIDEBAR PLAYERS
// ══════════════════════════════════════════
function renderSidebarPlayers(playersInRoom, myId, curPlayerId) {
    const list = $('sb-players-list'); list.innerHTML = '';
    let myRank = 1;
    const sorted = [...playersInRoom].sort((a, b) => b.handSize - a.handSize);
    sorted.forEach((p, i) => { if (p.id === myId) myRank = i + 1; });
    const leaderHandSize = sorted.length > 0 ? sorted[0].handSize : 0;

    playersInRoom.forEach(player => {
        const isMe = player.id === myId;
        const isActive = player.id === curPlayerId;
        const isLeader = player.handSize === leaderHandSize && leaderHandSize > 0 && !player.eliminated;
        const isElim = player.eliminated;
        const div = document.createElement('div');
        div.className = 'participant' + (isActive ? ' active' : '') + (isElim ? ' eliminated' : '');
        div.style.opacity = isElim ? '0.45' : '1';
        div.innerHTML = `
                    <img class="p-av" src="${player.avatar}" alt="">
                    <div class="p-info">
                        <div class="p-name">${isLeader ? '<span class="crown-icon">&nbsp;👑&nbsp;</span>' : ''}${player.username}${isMe ? ' <span style="font-size:0.6rem;opacity:0.6">(you)</span>' : ''}${isElim ? ' <span style="color:var(--red);font-size:0.65rem">OUT</span>' : ''}</div>
                        <div class="p-status">${isActive ? '⚡ Playing...' : isElim ? '💀 Eliminated' : player.handSize + ' cards'}</div>
                    </div>
                    <div class="p-cards" style="${isLeader ? 'color:#FFD700;border-color:rgba(255,215,0,0.4);background:rgba(255,215,0,0.08)' : ''}">${player.handSize}</div>
                `;
        list.appendChild(div);
    });

    $('stat-rank').textContent = myRank + (myRank === 1 ? 'st' : myRank === 2 ? 'nd' : myRank === 3 ? 'rd' : 'th');
}

// ══════════════════════════════════════════
//  TURN INDICATOR
// ══════════════════════════════════════════
function updateTurnIndicator(playerName) {
    const isMe = currentPlayerId === myPlayerId;
    currentTurnText.textContent = isMe ? '⚡ YOUR TURN' : `${playerName}'s Turn`;
    const chip = currentTurnText.closest('.turn-chip');
    chip.style.borderColor = isMe ? 'rgba(9,226,125,0.5)' : 'rgba(251,191,36,0.35)';
    chip.style.background = isMe ? 'rgba(9,226,125,0.12)' : 'rgba(251,191,36,0.08)';
    currentTurnText.style.color = isMe ? 'var(--green)' : '#fbbf24';
}

// ══════════════════════════════════════════
//  CHAT HELPERS
// ══════════════════════════════════════════
function addChatMsg(box, sender, text, isMine, isSystem = false) {
    const w = document.createElement('div');
    w.className = 'cmsg' + (isSystem ? ' sys' : isMine ? ' mine' : '');
    if (!isSystem) { const u = document.createElement('div'); u.className = 'cu'; u.textContent = sender; w.appendChild(u); }
    const b = document.createElement('div'); b.className = 'cb'; b.textContent = text; w.appendChild(b);
    box.appendChild(w); box.scrollTop = box.scrollHeight;
}
function addSystemMsg(text) {
    addChatMsg(chatMsgsEl, '', text, false, true);
    addChatMsg(mChatMsgsEl, '', text, false, true);
}

function sendChat(box, inputEl) {
    const t = inputEl.value.trim(); if (!t || !roomCode) return;
    socket.emit('chatMessage', { roomCode, username, message: t });
    inputEl.value = '';
}

$('chat-send-btn').addEventListener('click', () => sendChat(chatMsgsEl, chatInEl));
chatInEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(chatMsgsEl, chatInEl); });
$('m-chat-send').addEventListener('click', () => sendChat(mChatMsgsEl, mChatInEl));
mChatInEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(mChatMsgsEl, mChatInEl); });

document.querySelectorAll('.ebtn').forEach(b => b.addEventListener('click', () => { chatInEl.value += b.dataset.e; chatInEl.focus(); }));
document.querySelectorAll('.mebtn').forEach(b => b.addEventListener('click', () => { mChatInEl.value += b.dataset.e; mChatInEl.focus(); }));

socket.on('chatMessage', data => {
    const mine = data.username === username;
    addChatMsg(chatMsgsEl, data.username, data.message, mine);
    addChatMsg(mChatMsgsEl, data.username, data.message, mine);
});

// ══════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════
function spawnConfetti(container) {
    const colors = ['#FFD700', '#09e27d', '#1b96e9', '#f53906', '#8A2BE2', '#ff69b4'];
    for (let i = 0; i < 28; i++) {
        const p = document.createElement('div'); p.className = 'confetti-piece';
        p.style.cssText = `left:${Math.random() * 100}%;top:0;background:${colors[~~(Math.random() * colors.length)]};border-radius:${Math.random() > .5 ? '50%' : '2px'};width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;animation-delay:${Math.random() * 1.5}s;animation-duration:${2 + Math.random() * 2}s`;
        container.appendChild(p); setTimeout(() => p.remove(), 4500);
    }
}

// ══════════════════════════════════════════
//  LAYOUT SWITCH  mobile ↔ desktop
// ══════════════════════════════════════════
function applyLayout() {
    const mob = window.innerWidth <= 768;
    $('desktop-rows').style.display = mob ? 'none' : 'contents';
    $('m-opponents').style.display = mob ? 'grid' : 'none';
    $('m-bottom').style.display = mob ? 'grid' : 'none';
    const main = $('main');
    if (mob) {
        main.style.cssText = 'padding:7px;gap:7px;display:grid;grid-template-rows:1fr 1fr;grid-template-columns:1fr;overflow:hidden;';
    } else {
        main.style.cssText = 'padding:12px 14px;gap:10px;display:flex;flex-direction:column;overflow:hidden;';
    }
}
applyLayout(); window.addEventListener('resize', applyLayout);

// ══════════════════════════════════════════
//  FOOTER HOVER
// ══════════════════════════════════════════
const footer = document.getElementById('footer'), trigger = document.getElementById('footer-trigger');
let fT;
if (trigger) {
    trigger.addEventListener('mouseenter', () => { clearTimeout(fT); footer.style.transform = 'translateY(0)'; });
    footer.addEventListener('mouseenter', () => clearTimeout(fT));
    footer.addEventListener('mouseleave', () => { fT = setTimeout(() => footer.style.transform = 'translateY(100%)', 600); });
    trigger.addEventListener('mouseleave', () => { if (!footer.matches(':hover')) fT = setTimeout(() => footer.style.transform = 'translateY(100%)', 600); });
}
function addFooterLog(who, text) {
    const el = document.createElement('div'); el.className = 'flog';
    el.innerHTML = `<span class="who">${who}</span> ${text}`;
    const log = $('footer-log'); log.appendChild(el);
    if (log.children.length > 3) log.removeChild(log.firstChild);
}

// ══════════════════════════════════════════
//  SCREEN HELPERS
// ══════════════════════════════════════════
function showScreen(id) {
    ['welcome-screen', 'matchmaking-screen', 'lobby-screen', 'game-screen', 'results-overlay'].forEach(s => {
        const el = $(s);
        if (s === 'game-screen' || s === 'results-overlay') {
            el.style.display = s === id ? (s === 'results-overlay' ? 'flex' : 'block') : 'none';
        } else {
            el.style.display = s === id ? 'flex' : 'none';
        }
    });
}

// ══════════════════════════════════════════
//  BUTTON EVENTS
// ══════════════════════════════════════════
createRoomBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    if (!username) { showMessageBox('Please enter a username!'); return; }
    localStorage.setItem('ben10_username', username);
    socket.emit('createRoom', { username, avatar: myAvatar });
});

joinRoomBtn.addEventListener('click', () => {
    roomCode = roomCodeInput.value.trim().toUpperCase();
    username = usernameInput.value.trim();
    if (!roomCode) { showMessageBox('Please enter a room code.'); return; }
    localStorage.setItem('ben10_username', username);
    socket.emit('joinRoom', { roomCode, username, avatar: myAvatar });
});

copyRoomCodeBtn.addEventListener('click', () => {
    // Copy shareable link (includes ?room= param)
    const shareUrl = location.origin + location.pathname + '?room=' + (lobbyRoomCode.textContent || roomCode);
    navigator.clipboard.writeText(shareUrl)
        .then(() => showToast('📋 Link copied! Share it with friends.'))
        .catch(() => {
            // Fallback: copy just the code
            navigator.clipboard.writeText(lobbyRoomCode.textContent)
                .then(() => showToast('📋 Room code copied!'))
                .catch(() => showMessageBox('Failed to copy.'));
        });
});

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomCode, cardsPerPlayer: parseInt(cardsPerPlayerSel.value, 10) });
});

cardsPerPlayerSel.addEventListener('change', () => {
    socket.emit('setCardsPerPlayer', { roomCode, cardsPerPlayer: parseInt(cardsPerPlayerSel.value, 10) });
});

function handlePlayCard() {
    if (currentPlayerId !== myPlayerId) { showMessageBox("It's not your turn!"); return; }
    if (!playerCurrentCard) { showMessageBox("You have no card to play."); return; }
    if (currentPlayerId === myPlayerId && currentParamName.textContent === 'N/A' && selectedParameter === null) {
        showMessageBox("You won the last trick! Select a parameter on your card first."); return;
    }
    if (selectedParameter) {
        socket.emit('chooseParameter', { roomCode, parameter: selectedParameter });
        socket.emit('playCard', { roomCode });
    } else {
        socket.emit('playCard', { roomCode });
    }
}
playCardBtn.addEventListener('click', handlePlayCard);
mPlayBtn.addEventListener('click', handlePlayCard);

homeBtn.addEventListener('click', () => window.location.reload());
replayBtn.addEventListener('click', () => socket.emit('replayGame', { roomCode }));

// ══════════════════════════════════════════
//  SOCKET HANDLERS
// ══════════════════════════════════════════
socket.on('connect', () => {
    myPlayerId = socket.id;
    initAvatarSelection();
});

socket.on('roomCreated', code => {
    roomCode = code; isHost = true;
    // Push shareable URL
    history.replaceState({}, '', '?room=' + roomCode);
    showScreen('lobby-screen');
    lobbyRoomCode.textContent = roomCode;
    myUsernameSpan.textContent = username;
    myAvatarImg.src = myAvatar;
    startGameBtn.style.display = 'block';
    startGameMessage.style.display = 'block';
    hostMessage.style.display = 'none';
    cardCountSelDiv.style.display = 'flex';
    showMessageBox(`Room created! 🎉 Share link: ${location.href}`);
});

socket.on('roomJoined', data => {
    roomCode = data.roomCode; username = data.username; myAvatar = data.avatar; isHost = false;
    // Push shareable URL
    history.replaceState({}, '', '?room=' + roomCode);
    showScreen('lobby-screen');
    lobbyRoomCode.textContent = roomCode;
    myUsernameSpan.textContent = username;
    myAvatarImg.src = myAvatar;
    startGameBtn.style.display = 'none';
    startGameMessage.style.display = 'none';
    hostMessage.style.display = 'block';
    cardCountSelDiv.style.display = 'none';
    showMessageBox(`Joined room ${roomCode}! 🚀`);
});

// ══ MATCHMAKING HANDLERS (Task 4) ══════════════════════════════
const matchmakingScreen = $('matchmaking-screen');
const mqStatusText = $('mq-status-text');
const mqCountText = $('mq-count-text');
const mqCountdownEl = $('mq-countdown');
const mqCountdownWrap = $('mq-countdown-wrap');

socket.on('queueUpdate', ({ count }) => {
    if (mqCountText) mqCountText.textContent = `${count} in queue`;
});

socket.on('matchmade', ({ roomCode: rc, username: un, avatar: av, isHost: host }) => {
    roomCode = rc; username = un; myAvatar = av; isHost = host;
    history.replaceState({}, '', '?room=' + roomCode);
    if (mqStatusText) mqStatusText.textContent = 'MATCH FOUND!';
    if (mqCountdownWrap) mqCountdownWrap.style.display = 'flex';
});

socket.on('matchCountdown', ({ seconds }) => {
    if (mqCountdownEl) {
        mqCountdownEl.textContent = seconds;
        mqCountdownEl.style.transform = 'scale(1.3)';
        setTimeout(() => { mqCountdownEl.style.transform = 'scale(1)'; }, 220);
    }
    if (seconds === 0) {
        showScreen('lobby-screen');
        lobbyRoomCode.textContent = roomCode;
        myUsernameSpan.textContent = username;
        myAvatarImg.src = myAvatar;
        startGameBtn.style.display = 'none';
        startGameMessage.style.display = 'none';
        hostMessage.style.display = 'block';
        hostMessage.textContent = '⚡ Game starting…';
        cardCountSelDiv.style.display = 'none';
    }
});

const cancelQueueBtn = $('cancel-queue-btn');
if (cancelQueueBtn) cancelQueueBtn.addEventListener('click', () => {
    socket.emit('leaveQueue');
    history.replaceState({}, '', location.pathname);
    showScreen('welcome-screen');
});

socket.on('updateLobby', players => {
    playersList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li'); li.className = 'lobby-player-item';
        li.innerHTML = `<img src="${p.avatar}" style="width:34px;height:34px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.14)">
                    <span style="font-weight:800">${p.username}</span>
                    ${p.isHost ? '<span style="margin-left:auto;font-size:0.65rem;background:rgba(9,226,125,0.12);color:var(--green);padding:2px 8px;border-radius:99px;border:1px solid rgba(9,226,125,0.28)">HOST</span>' : ''}`;
        playersList.appendChild(li);
    });
    playerCountSpan.textContent = players.length;
    if (isHost) {
        const ok = players.length >= 2 && players.length <= 5;
        startGameBtn.disabled = !ok;
        startGameMessage.style.display = ok ? 'none' : 'block';
    }
});

socket.on('lobbySettingUpdate', data => {
    if (data.cardsPerPlayer) {
        cardsPerPlayerSel.value = data.cardsPerPlayer;
        showMessageBox(`Cards per player set to ${data.cardsPerPlayer}`);
    }
});

socket.on('gameStarted', data => {
    showScreen('game-screen');
    availableParameters = data.availableParameters;
    roundCount = 1; $('stat-round') && ($('stat-round').textContent = roundCount);

    $('my-game-avatar').src = myAvatar;
    $('my-game-name').textContent = username;
    $('m-my-avatar').src = myAvatar;
    $('m-my-name').textContent = username;

    currentPlayerId = data.currentPlayerId;
    updateTurnIndicator(data.currentPlayerName);
    currentParamName.textContent = data.currentParameter ? data.currentParameter.toUpperCase() : 'N/A';
    $('footer-param').textContent = data.currentParameter || '—';

    renderPlayerHandAndDeck(
        data.currentCard,
        data.handSize - (data.currentCard ? 1 : 0),
        data.currentPlayerId === myPlayerId && !data.currentParameter
    );

    renderOpponentSlots(data.playersInRoom, myPlayerId, currentPlayerId, data.playedCards || [], data.currentParameter);
    renderSidebarPlayers(data.playersInRoom, myPlayerId, currentPlayerId);

    playCardBtn.disabled = (currentPlayerId !== myPlayerId) || (currentPlayerId === myPlayerId && !data.currentParameter);
    mPlayBtn.disabled = playCardBtn.disabled;

    addSystemMsg('🎮 Game started! Good luck!');
    if (currentPlayerId === myPlayerId && !data.currentParameter) {
        showGameNotif('⚡ You go first! Pick a stat on your card, then play.', 'win');
    } else {
        showGameNotif('🎮 Game started! Waiting for first player…');
    }
    applyLayout();
});

socket.on('updateGame', data => {
    currentPlayerId = data.currentPlayerId;
    updateTurnIndicator(data.currentPlayerName);
    currentParamName.textContent = data.currentParameter ? data.currentParameter.toUpperCase() : 'N/A';
    $('footer-param').textContent = data.currentParameter || '—';

    renderOpponentSlots(data.playersInRoom, myPlayerId, currentPlayerId, data.playedCards || [], data.currentParameter);
    renderSidebarPlayers(data.playersInRoom, myPlayerId, currentPlayerId);

    if (data.playedCards && data.playedCards.length > 0) {
        const last = data.playedCards[data.playedCards.length - 1];
        addFooterLog(last.playerName, `played ${last.card.name}`);
    }

    // Show card-won toast
    if (data.trickWinnerId && data.cardsWon > 0) {
        const winnerPlayer = (data.playersInRoom || []).find(p => p.id === data.trickWinnerId);
        if (winnerPlayer) {
            const isMe = data.trickWinnerId === myPlayerId;
            showToast(`⚡ ${isMe ? 'You' : winnerPlayer.username} gained ${data.cardsWon} card${data.cardsWon > 1 ? 's' : ''}!`);
        }
    }

    const isMyTurn = data.currentPlayerId === myPlayerId;
    if (isMyTurn && data.promptChooseParameter) {
        renderPlayerHandAndDeck(playerCurrentCard, playerDeckSize, true);
        trickCount++; $('stat-tricks') && ($('stat-tricks').textContent = trickCount);
        roundCount++; $('stat-round') && ($('stat-round').textContent = roundCount);
    } else if (isMyTurn && playerCurrentCard) {
        selectCard(playerCardArea.querySelector('.pcard'), playerCurrentCard);
    }

    // Disable everything if spectating
    if (isSpectating) {
        playCardBtn.disabled = true;
        mPlayBtn.disabled = true;
    } else {
        playCardBtn.disabled = !isMyTurn || (isMyTurn && !data.currentParameter);
        mPlayBtn.disabled = playCardBtn.disabled;
    }

    if (!isSpectating) {
        if (isMyTurn && data.promptChooseParameter) {
            showGameNotif('🏆 You won the trick! Pick a stat and play.', 'win');
            addSystemMsg('🏆 You won the trick!');
        } else if (isMyTurn) {
            showGameNotif('⚡ Your turn — play a card!');
        } else {
            showGameNotif(`Waiting for ${data.currentPlayerName}…`);
        }
    }
});

// ── FIX: dim the played card instead of clearing it ─────────
socket.on('cardPlayed', data => {
    if (data.playerId === myPlayerId) {
        // Keep showing the card but mark it as "in play" (dimmed)
        // So the player sees their card is being compared, not gone
        playCardBtn.disabled = true;
        mPlayBtn.disabled = true;
        // Dim the card visually to show it's been submitted
        [playerCardArea, mPlayerCardArea].forEach(area => {
            const cardEl = area.querySelector('.pcard');
            if (cardEl) {
                cardEl.style.opacity = '0.45';
                cardEl.style.pointerEvents = 'none';
                // Add "IN PLAY" overlay label
                if (!cardEl.querySelector('.in-play-lbl')) {
                    const lbl = document.createElement('div');
                    lbl.className = 'in-play-lbl';
                    lbl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Bangers,cursive;font-size:0.9rem;letter-spacing:2px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.9);z-index:10;pointer-events:none;';
                    lbl.textContent = '⚡ IN PLAY';
                    cardEl.appendChild(lbl);
                }
            }
        });
    }
});

// ── New card drawn after trick resolves ──────────────────────
socket.on('drawCard', data => {
    playerCurrentCard = data.currentCard;
    playerDeckSize = data.handSize - (playerCurrentCard ? 1 : 0);
    // Re-render with new card; isWinnerChoosing handled by updateGame promptChooseParameter
    renderPlayerHandAndDeck(playerCurrentCard, playerDeckSize, false);
});

// ── Toast helper ─────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 2200) {
    const t = $('toast'); if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Player eliminated (sent only to that player) ─────────────
let isSpectating = false;
socket.on('playerEliminated', ({ username: elimName }) => {
    $('spectator-overlay').style.display = 'flex';
    // Disable play controls
    playCardBtn.disabled = true;
    mPlayBtn.disabled = true;
    isSpectating = false;
});

$('spectate-btn').addEventListener('click', () => {
    $('spectator-overlay').style.display = 'none';
    isSpectating = true;
    socket.emit('spectateGame', { roomCode });
    // Add spectating banner
    if (!$('spectate-banner')) {
        const banner = document.createElement('div');
        banner.id = 'spectate-banner';
        banner.className = 'spectator-banner';
        banner.textContent = '👁 SPECTATING — You have been eliminated';
        $('game-screen').prepend(banner);
    }
});

$('elim-home-btn').addEventListener('click', () => window.location.reload());

// ── Spectator joined: receive current game state ─────────────
socket.on('spectatorJoined', data => {
    currentPlayerId = data.currentPlayerId;
    if (currentPlayerId) updateTurnIndicator(data.currentPlayerName);
    currentParamName.textContent = data.currentParameter ? data.currentParameter.toUpperCase() : 'N/A';
    renderOpponentSlots(data.playersInRoom, myPlayerId, currentPlayerId, data.playedCards || [], data.currentParameter);
    renderSidebarPlayers(data.playersInRoom, myPlayerId, currentPlayerId);
});

// ── Another player eliminated (broadcast to room) ────────────
socket.on('playerEliminatedBroadcast', ({ username: elimName }) => {
    showToast(`💀 ${elimName} has been eliminated!`, 3000);
    addSystemMsg(`💀 ${elimName} has been eliminated!`);
});

socket.on('gameOver', data => {
    showScreen('results-overlay');
    spawnConfetti($('results-screen'));

    const rankClass = ['rank-1', 'rank-2', 'rank-3'];
    const rankEmoji = ['🥇', '🥈', '🥉'];
    resultsContent.innerHTML = `
                <div style="text-align:center;margin-bottom:16px">
                    <p style="font-family:'Bangers',cursive;font-size:2rem;color:var(--green)">${data.winner ? data.winner.username + ' wins! 🏆' : 'Game Over!'}</p>
                    ${data.totalTime ? `<p style="color:var(--txt-muted);font-size:0.85rem;margin-top:4px">Total time: ${data.totalTime}</p>` : ''}
                    ${data.numHands ? `<p style="color:var(--txt-muted);font-size:0.85rem">Hands played: ${data.numHands}</p>` : ''}
                </div>
                <p style="font-size:0.7rem;color:var(--txt-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Final Standings</p>
                ${(data.standings || []).map((p, i) => `
                    <div class="results-player-item">
                        <span class="${rankClass[i] || ''}">${rankEmoji[i] || '#' + (i + 1)}</span>
                        <img src="${p.avatar || 'https://placehold.co/34x34/555/fff?text=P'}" alt="">
                        <span style="flex:1;font-weight:800">${p.username}</span>
                        <span style="font-family:'Bangers',cursive;color:var(--green);font-size:1.2rem">${p.handSize} cards</span>
                    </div>
                `).join('')}
            `;
    addSystemMsg(`🏆 ${data.winner ? data.winner.username + ' won the game!' : 'Game over!'}`);
});

socket.on('errorMessage', msg => showMessageBox('Error: ' + msg));
socket.on('playerLeft', name => {
    showMessageBox(`${name} has left the room.`);
    addSystemMsg(`${name} left the room.`);
});

// ── Auto-play countdown handler ───────────────────────────────
let _apCountInterval;
socket.on('autoPlayCountdown', ({ seconds }) => {
    const el = $('autoplay-countdown'); if (!el) return;
    clearInterval(_apCountInterval);
    let t = seconds;
    el.textContent = `⏱ Auto-play in ${t}s`;
    el.classList.add('visible');
    _apCountInterval = setInterval(() => {
        t--;
        if (t <= 0) { clearInterval(_apCountInterval); el.classList.remove('visible'); }
        else el.textContent = `⏱ Auto-play in ${t}s`;
    }, 1000);
});
// Clear countdown when trick is done or new round starts
socket.on('autoPlayed', ({ playerId, playerName }) => {
    clearInterval(_apCountInterval);
    const el = $('autoplay-countdown'); if (el) el.classList.remove('visible');
    if (playerId !== myPlayerId) {
        addSystemMsg(`⏱ ${playerName} auto-played (5s timer)`);
    } else {
        showGameNotif('⏱ Auto-played — you were away!', 'warn');
    }
});

// ──────────────────────────────────────────
//  CURSOR + LIGHTNING (ben.html elements)
// ──────────────────────────────────────────
const cur = document.getElementById('cur');
const cur2 = document.getElementById('cur2');
let cx = 0, cy = 0, cx2 = 0, cy2 = 0;
document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });
(function animCursor() {
    cur.style.left = cx + 'px'; cur.style.top = cy + 'px';
    cx2 += (cx - cx2) * 0.18; cy2 += (cy - cy2) * 0.18;
    cur2.style.left = cx2 + 'px'; cur2.style.top = cy2 + 'px';
    requestAnimationFrame(animCursor);
})();
document.addEventListener('mousedown', () => { cur.style.transform = 'translate(-50%,-50%) scale(1.6)'; });
document.addEventListener('mouseup', () => { cur.style.transform = 'translate(-50%,-50%) scale(1)'; });

// Spawn lightning bolts
(function spawnBolts() {
    const container = document.getElementById('lightning');
    const makeB = () => {
        const b = document.createElement('div'); b.className = 'bolt';
        const h = 60 + Math.random() * 160;
        b.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;height:${h}px;animation-duration:${1.5 + Math.random() * 3}s;animation-delay:${Math.random() * 4}s`;
        container.appendChild(b);
        setTimeout(() => b.remove(), (1.5 + Math.random() * 5) * 1000 + 500);
    };
    for (let i = 0; i < 6; i++) makeB();
    setInterval(() => makeB(), 1200);
})();

// ──────────────────────────────────────────
//  INITIAL STATE + URL ?room= auto-join
// ──────────────────────────────────────────
showScreen('welcome-screen');

// Highlight room code pre-fill or handle ?mode=online
(function checkUrlParams() {
    const params = new URLSearchParams(location.search);

    // Task 4: Matchmaking auto-join
    if (params.get('mode') === 'online') {
        showScreen('matchmaking-screen');
        // Give a short delay to ensure socket is ready and avatars are initialized
        setTimeout(() => {
            // Try to use typed username, or pick a temporary one
            username = usernameInput.value.trim() || `Alien-${Math.floor(Math.random() * 9999)}`;
            socket.emit('joinQueue', { username, avatar: myAvatar });
        }, 300);
        return;
    }

    const urlRoom = params.get('room');
    if (!urlRoom) return;
    roomCodeInput.value = urlRoom.toUpperCase();
    // Visually signal the pre-filled code
    roomCodeInput.style.borderColor = 'var(--green)';
    roomCodeInput.style.boxShadow = '0 0 0 3px rgba(9,226,125,0.2)';
    usernameInput.focus();
    // Show a subtle banner so the user knows they're joining a specific room
    const hint = document.createElement('p');
    hint.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--green);margin-top:-4px;letter-spacing:1px';
    hint.innerHTML = `⚡ Joining room <strong>${urlRoom.toUpperCase()}</strong> — enter your name and click JOIN`;
    roomCodeInput.parentElement.appendChild(hint);
    setTimeout(() => hint.remove(), 8000);
})();