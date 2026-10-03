const mineflayer = require('mineflayer');
const http = require('http');

// ========================================================
// 1. CẤU HÌNH HỆ THỐNG & CHỐNG CRASH CORE
// ========================================================
const CONFIG = {
    host: process.env.SERVER_HOST || 'ketkat.play.hosting',
    port: parseInt(process.env.SERVER_PORT) || 25565,
    username: process.env.BOT_USERNAME || 'tod',
    password: process.env.BOT_PASSWORD || 'DucMinh2026@',
    version: false, // Tự động nhận diện phiên bản server
    checkTimeoutInterval: 120000
};

process.on('uncaughtException', (err) => console.log('[SYSTEM WARNING]', err.message));
process.on('unhandledRejection', (reason) => console.log('[SYSTEM WARNING]', reason));

let startTime = Date.now();
let botStatus = {
    connected: "🔴 Chưa kết nối (Đang khởi động...)",
    gameMode: "Không rõ",
    pos: { x: 0, y: 0, z: 0 },
    health: 0,
    food: 0,
    nearbyPlayers: []
};

let botInstance = null;
let afkInterval = null;
let updateInterval = null;
let reconnectTimeout = null;

// ========================================================
// 2. WEB DASHBOARD SIÊU NGẮN GỌN
// ========================================================
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    try {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;

        const playersList = botStatus.nearbyPlayers.length === 0 
            ? '<li>Không có ai xung quanh...</li>' 
            : botStatus.nearbyPlayers.map(p => `<li><b>${escapeHtml(p.name)}</b> (X: ${p.x}, Y: ${p.y}, Z: ${p.z})</li>`).join('');

        res.end(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bot Dashboard</title>
    <meta http-equiv="refresh" content="3">
    <style>
        body { font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 0 10px; line-height: 1.6; }
        h3 { border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
        ul { padding-left: 20px; }
    </style>
</head>
<body>
    <h2>🤖 Bot Dashboard</h2>
    <p><b>Trạng thái:</b> ${botStatus.connected}</p>
    <p><b>Online:</b> ${h}h ${m}m ${s}s</p>
    <p><b>Chế độ chơi:</b> ${botStatus.gameMode}</p>
    <p><b>Tọa độ:</b> X: ${botStatus.pos.x} | Y: ${botStatus.pos.y} | Z: ${botStatus.pos.z}</p>
    <p><b>Chỉ số:</b> ❤️ ${botStatus.health}/20 | 🍗 ${botStatus.food}/20</p>

    <h3>👥 Người chơi xung quanh (${botStatus.nearbyPlayers.length})</h3>
    <ul>${playersList}</ul>
</body>
</html>`);
    } catch (e) {
        res.end("Đang tải...");
    }
}).listen(PORT, () => console.log(`[HTTP] Server chạy tại port: ${PORT}`));

// Self-Ping giữ Render chạy 24/7
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    http.get(url, () => {}).on('error', () => {});
}, 5 * 60 * 1000);

// ========================================================
// 3. CORE BOT ENGINE (CHỐNG THROTTLE BẢO VỆ KẾT NỐI)
// ========================================================
function createBot() {
    if (botInstance) return;

    try {
        console.log(`[BOT] Đang kết nối tới ${CONFIG.host}:${CONFIG.port}...`);
        const bot = mineflayer.createBot({
            host: CONFIG.host,
            port: CONFIG.port,
            username: CONFIG.username,
            version: CONFIG.version,
            checkTimeoutInterval: CONFIG.checkTimeoutInterval
        });

        botInstance = bot;

        // Auto Login / Register
        bot.on('messagestr', (message) => {
            try {
                const msg = message.toLowerCase();
                if (msg.includes('/login') || msg.includes('đăng nhập') || msg.includes('dang nhap') || msg.includes('login')) {
                    setTimeout(() => { if (botInstance?.chat) botInstance.chat(`/login ${CONFIG.password}`); }, 1500);
                } else if (msg.includes('/register') || msg.includes('đăng ký') || msg.includes('dang ky') || msg.includes('register')) {
                    setTimeout(() => { if (botInstance?.chat) botInstance.chat(`/register ${CONFIG.password} ${CONFIG.password}`); }, 1500);
                }
            } catch (e) {}
        });

        bot.on('spawn', () => {
            try {
                console.log('[BOT] Đã Spawn vào Game thành công!');
                botStatus.connected = "🟢 Đã tham gia server!";
                if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
                
                startSafeAntiAFK(bot);
                startDataSyncInterval(bot);
            } catch (e) {}
        });

        bot.on('death', () => {
            console.log('[BOT] Hồi sinh sau 1s...');
            setTimeout(() => { try { botInstance?.respawn(); } catch (e) {} }, 1000);
        });

        // XỬ LÝ CHỐNG THROTTLE / KICK
        bot.on('kicked', (reason) => { 
            console.log('[BOT] Bị Kick:', reason); 
            const reasonStr = JSON.stringify(reason).toLowerCase();
            
            if (reasonStr.includes('throttled') || reasonStr.includes('wait')) {
                console.log('[BOT] Phát hiện bị IP Throttled! Chờ 30s...');
                triggerReconnect(30000);
            } else {
                triggerReconnect(15000);
            }
        });

        bot.on('end', () => { 
            console.log('[BOT] Kết nối đóng.'); 
            triggerReconnect(15000); 
        });

        bot.on('error', (err) => { 
            console.log('[BOT ERROR]:', err.message); 
            triggerReconnect(15000); 
        });

    } catch (e) {
        triggerReconnect(15000);
    }
}

// ========================================================
// 4. QUẢN LÝ LUỒNG & ANTI-AFK
// ========================================================
function triggerReconnect(delay) {
    cleanUp();
    if (!reconnectTimeout) {
        botStatus.connected = `🔴 Kết nối lại sau ${delay / 1000}s...`;
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            createBot();
        }, delay);
    }
}

function cleanUp() {
    if (afkInterval) clearInterval(afkInterval);
    if (updateInterval) clearInterval(updateInterval);
    afkInterval = null;
    updateInterval = null;
    
    if (botInstance) {
        try { 
            botInstance.removeAllListeners();
            botInstance.quit(); 
        } catch(e) {}
        botInstance = null;
    }
    botStatus.gameMode = "Không rõ";
    botStatus.nearbyPlayers = [];
}

function startSafeAntiAFK(bot) {
    if (afkInterval) clearInterval(afkInterval);
    afkInterval = setInterval(() => {
        if (!bot?.entity || !botInstance) return;
        try {
            bot.look((Math.random() * 360 - 180) * (Math.PI / 180), (Math.random() * 60 - 30) * (Math.PI / 180), true);
            bot.swingArm('mainhand');
            if (Math.random() < 0.3) {
                bot.setControlState('jump', true);
                setTimeout(() => { if (botInstance && bot) bot.setControlState('jump', false); }, 400);
            }
        } catch (e) {}
    }, 10000);
}

function startDataSyncInterval(bot) {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        try {
            if (!bot?.entity || !botInstance) return;

            botStatus.pos = {
                x: Math.round(bot.entity.position.x) || 0,
                y: Math.round(bot.entity.position.y) || 0,
                z: Math.round(bot.entity.position.z) || 0
            };
            botStatus.gameMode = bot.game?.gameMode || "Không rõ";
            botStatus.health = Math.round(bot.health) || 0;
            botStatus.food = Math.round(bot.food) || 0;

            let targets = [];
            if (bot.entities) {
                for (const id in bot.entities) {
                    const entity = bot.entities[id];
                    if (entity?.type === 'player' && entity.username !== bot.username) {
                        targets.push({
                            name: entity.username,
                            x: Math.round(entity.position.x) || 0,
                            y: Math.round(entity.position.y) || 0,
                            z: Math.round(entity.position.z) || 0
                        });
                    }
                }
            }
            botStatus.nearbyPlayers = targets;
        } catch (e) {}
    }, 1000);
}

function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

createBot();
