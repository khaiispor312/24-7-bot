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
    version: false, // false = Tự động nhận diện phiên bản server (Tránh lỗi version)
    checkTimeoutInterval: 120000 // 2 phút check timeout
};

// Khóa chống văng ứng dụng ở tầng hệ thống
process.on('uncaughtException', (err) => {
    console.log('[SYSTEM WARNING] Bắt lỗi ngầm UncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.log('[SYSTEM WARNING] Bắt lỗi ngầm UnhandledRejection:', reason);
});

// BIẾN QUẢN LÝ TRẠNG THÁI & LƯU TRỮ
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
// 2. WEB DASHBOARD & CƠ CHẾ SELF-PING (CHỐNG NGU RENDER)
// ========================================================
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    try {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        // Tính thời gian Uptime
        const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

        let html = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Vertex System - Bot Dashboard</title>
            <meta http-equiv="refresh" content="3">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f111a; color: #ffffff; padding: 20px; margin: 0; }
                .card { background: #1a1c2a; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); max-width: 650px; margin: 20px auto; border: 1px solid #2a2d42; }
                h2 { color: #00e676; border-bottom: 2px solid #2a2d42; padding-bottom: 10px; margin-top: 0; font-size: 20px; }
                .stat { margin: 12px 0; font-size: 15px; display: flex; justify-content: space-between; }
                .label { color: #8892b0; font-weight: 600; }
                .value { color: #f8f8f2; font-weight: 500; }
                .player-card { background: #111322; padding: 10px 14px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #00b0ff; display: flex; justify-content: space-between; }
                .heart { color: #ff1744; font-weight: bold; } 
                .food { color: #ff9100; font-weight: bold; }
                .badge { background: #292d3e; padding: 3px 8px; border-radius: 4px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🤖 VERTEX SYSTEM: MONITORING</h2>
                <div class="stat"><span class="label">Trạng thái:</span> <span class="value">${botStatus.connected}</span></div>
                <div class="stat"><span class="label">Thời gian Online:</span> <span class="value badge">${uptimeStr}</span></div>
                <div class="stat"><span class="label">Chế độ chơi:</span> <span class="value" style="text-transform: uppercase; color: #00b0ff;">${botStatus.gameMode}</span></div>
                <div class="stat"><span class="label">Tọa độ Bot:</span> <span class="value">X: ${botStatus.pos.x} | Y: ${botStatus.pos.y} | Z: ${botStatus.pos.z}</span></div>
                <div class="stat"><span class="label">Máu:</span> <span class="value heart">❤️ ${botStatus.health}/20</span></div>
                <div class="stat"><span class="label">Đức ăn:</span> <span class="value food">🍗 ${botStatus.food}/20</span></div>
                
                <h2 style="margin-top: 25px;">👥 NGƯỜI CHƠI XUNG QUANH (${botStatus.nearbyPlayers.length})</h2>
        `;

        if (botStatus.nearbyPlayers.length === 0) {
            html += `<p style="color: #6272a4; font-style: italic;">Không tìm thấy người chơi nào trong phạm vi nhận diện...</p>`;
        } else {
            html += botStatus.nearbyPlayers.map(p => 
                `<div class="player-card">
                    <span>👤 <b>${escapeHtml(p.name)}</b></span>
                    <span style="color: #a6e22e;">X: ${p.x} | Y: ${p.y} | Z: ${p.z}</span>
                </div>`
            ).join('');
        }

        html += `</div></body></html>`;
        res.end(html);
    } catch (webErr) {
        res.end("Đang tải dữ liệu Bot...");
    }
}).listen(PORT, () => {
    console.log(`[HTTP] Web Dashboard đã sẵn sàng tại port: ${PORT}`);
});

// Self-Ping giữ Render luôn chạy (mỗi 5 phút)
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    http.get(url, () => {}).on('error', () => {});
}, 5 * 60 * 1000);

// ========================================================
// 3. CORE BOT ENGINE (RECONNECT, ANTI-AFK & AUTO LOG)
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

        // XỬ LÝ AUTO LOGIN / REGISTER LINH HOẠT
        bot.on('messagestr', (message) => {
            try {
                const msg = message.toLowerCase();
                if (msg.includes('/login') || msg.includes('đăng nhập') || msg.includes('dang nhap') || msg.includes('login')) {
                    setTimeout(() => {
                        if (botInstance && typeof botInstance.chat === 'function') {
                            botInstance.chat(`/login ${CONFIG.password}`);
                        }
                    }, 1500);
                } 
                else if (msg.includes('/register') || msg.includes('đăng ký') || msg.includes('dang ky') || msg.includes('register')) {
                    setTimeout(() => {
                        if (botInstance && typeof botInstance.chat === 'function') {
                            botInstance.chat(`/register ${CONFIG.password} ${CONFIG.password}`);
                        }
                    }, 1500);
                }
            } catch (e) {}
        });

        // KHI BOT VÀO GAME THÀNH CÔNG
        bot.on('spawn', () => {
            try {
                console.log('[BOT] Đã Spawn vào Game thành công!');
                botStatus.connected = "🟢 Đã tham gia server thành công!";
                
                if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
                
                // Khởi động hệ thống Anti-AFK & Đồng bộ thông số
                startSafeAntiAFK(bot);
                startDataSyncInterval(bot);

            } catch (spawnErr) {
                console.log('[BOT ERROR] Lỗi sự kiện Spawn:', spawnErr.message);
            }
        });

        // TỰ ĐỘNG HỒI SINH SAU KHÓA CHẾT
        bot.on('death', () => {
            console.log('[BOT] Bot đã bị hạ gục. Đang hồi sinh sau 1s...');
            setTimeout(() => { 
                try {
                    if (botInstance && typeof botInstance.respawn === 'function') {
                        botInstance.respawn(); 
                    }
                } catch (e) {}
            }, 1000);
        });

        // BẮT CÁC SỰ KIỆN MẤT KẾT NỐI
        bot.on('kicked', (reason) => {
            console.log('[BOT] Bị Kick khỏi server:', reason);
            triggerReconnect(3000);
        });
        bot.on('end', () => {
            console.log('[BOT] Kết nối đóng (End).');
            triggerReconnect(3000);
        });
        bot.on('error', (err) => {
            console.log('[BOT ERROR] Lỗi socket:', err.message);
            triggerReconnect(3000);
        });

    } catch (e) {
        console.log('[BOT ERROR] Không thể khởi tạo Bot:', e.message);
        triggerReconnect(3000);
    }
}

// ========================================================
// 4. CÁC HÀM BỔ TRỢ & QUẢN LÝ LUỒNG
// ========================================================

// Tự động kết nối lại tập trung (Chống trùng lặp Timeout)
function triggerReconnect(delay) {
    cleanUp();
    if (!reconnectTimeout) {
        botStatus.connected = `🔴 Đang kết nối lại sau ${delay / 1000}s...`;
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            createBot();
        }, delay);
    }
}

// Dọn dẹp tài nguyên & Memory Leak
function cleanUp() {
    if (afkInterval) { clearInterval(afkInterval); afkInterval = null; }
    if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
    
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

// ANTI-AFK AN TOÀN (Xoay đầu, Vẫy tay, Nhảy nhẹ - Không lo ngã hố)
function startSafeAntiAFK(bot) {
    if (afkInterval) clearInterval(afkInterval);
    
    afkInterval = setInterval(() => {
        if (!bot || !bot.entity || !botInstance) return;
        try {
            // 1. Xoay hướng nhìn ngẫu nhiên
            const yaw = (Math.random() * 360 - 180) * (Math.PI / 180);
            const pitch = (Math.random() * 60 - 30) * (Math.PI / 180);
            bot.look(yaw, pitch, true);

            // 2. Vẫy tay (Swing Arm)
            bot.swingArm('mainhand');

            // 3. Tỷ lệ 30% nhảy nhẹ tại chỗ
            if (Math.random() < 0.3) {
                bot.setControlState('jump', true);
                setTimeout(() => {
                    if (botInstance && bot) bot.setControlState('jump', false);
                }, 400);
            }
        } catch (e) {}
    }, 8000 + Math.random() * 4000); // Mỗi 8 - 12 giây thực hiện 1 lần
}

// LẶP ĐỒNG BỘ DỮ LIỆU ĐỂ HIỂN THỊ WEB DASHBOARD
function startDataSyncInterval(bot) {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
        try {
            if (!bot || !bot.entity || !botInstance) return;

            botStatus.pos = {
                x: Math.round(bot.entity.position.x) || 0,
                y: Math.round(bot.entity.position.y) || 0,
                z: Math.round(bot.entity.position.z) || 0
            };
            botStatus.gameMode = bot.game ? (bot.game.gameMode || "Không rõ") : "Không rõ";
            botStatus.health = bot.health ? Math.round(bot.health) : 0;
            botStatus.food = bot.food ? Math.round(bot.food) : 0;

            let targets = [];
            if (bot.entities) {
                for (const id in bot.entities) {
                    const entity = bot.entities[id];
                    if (entity && entity.type === 'player' && entity.username !== bot.username) {
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
        } catch (loopErr) {}
    }, 1000);
}

// Xử lý Escape HTML bảo mật cho Dashboard
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// KHỞI CHẠY BOT
createBot();
