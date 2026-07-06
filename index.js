const mineflayer = require('mineflayer');
const http = require('http');

// ========================================================
// 1. CHỐNG CRASH TUYỆT ĐỐI Ở TẦNG CORE (BẮT TẤT CẢ LỖI NGẦM)
// ========================================================
process.on('uncaughtException', (err) => {
    // Không làm gì cả, nuốt lỗi để Node.js không bao giờ bị sập
});
process.on('unhandledRejection', (reason, promise) => {
    // Cô lập hoàn toàn lỗi bất đồng bộ
});

// BIẾN LƯU TRỮ DỮ LIỆU ĐỂ WEB SERVER HIỂN THỊ
let botStatus = {
    connected: "Chưa kết nối (Đang chờ...)",
    gameMode: "Không rõ",
    pos: { x: 0, y: 0, z: 0 },
    health: 0,
    food: 0,
    nearbyPlayers: []
};

// ========================================================
// 2. WEB SERVER ĐỘC LẬP - GIỮ ALIVE TRÊN RENDER 100%
// ========================================================
// Web server chạy hoàn toàn biệt lập, không dính dáng tới lỗi của bot
http.createServer((req, res) => {
    try {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        
        let html = `
        <html>
        <head>
            <title>Vertex System - Bot Dashboard</title>
            <meta http-equiv="refresh" content="3">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f111a; color: #ffffff; padding: 20px; }
                .card { background: #1a1c2a; border-radius: 10px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); max-width: 600px; margin: 0 auto; }
                h2 { color: #00e676; border-bottom: 2px solid #2a2d42; padding-bottom: 10px; margin-top: 0; }
                .stat { margin: 12px 0; font-size: 16px; }
                .label { color: #8892b0; font-weight: bold; }
                .value { color: #f8f8f2; }
                .player-list { background: #111322; padding: 10px; border-radius: 5px; margin-top: 10px; border-left: 4px solid #00b0ff; }
                .heart { color: #ff1744; } .food { color: #ff9100; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🤖 VERTEX SYSTEM: STATUS</h2>
                <div class="stat"><span class="label">Trạng thái:</span> <span class="value">${botStatus.connected}</span></div>
                <div class="stat"><span class="label">Chế độ chơi:</span> <span class="value" style="text-transform: uppercase; color: #00b0ff;">${botStatus.gameMode}</span></div>
                <div class="stat"><span class="label">Tọa độ bot:</span> <span class="value">X: ${botStatus.pos.x} | Y: ${botStatus.pos.y} | Z: ${botStatus.pos.z}</span></div>
                <div class="stat"><span class="label">Thanh máu:</span> <span class="value heart">❤️ ${botStatus.health}/20</span></div>
                <div class="stat"><span class="label">Thanh đói:</span> <span class="value food">🍗 ${botStatus.food}/20</span></div>
                
                <h2>👥 NGƯỜI CHƠI TRONG TẦM NHÌN (${botStatus.nearbyPlayers.length})</h2>
        `;

        if (botStatus.nearbyPlayers.length === 0) {
            html += `<p style="color: #6272a4; font-style: italic;">Không có player nào xung quanh...</p>`;
        } else {
            html += botStatus.nearbyPlayers.map(p => `<div class="player-list">👤 <b>${p.name}</b> -> <span style="color: #a6e22e;">X: ${p.x} | Y: ${p.y} | Z: ${p.z}</span></div>`).join('');
        }

        html += `</div></body></html>`;
        res.end(html);
    } catch (webErr) {
        res.end("Mạng lỗi tạm thời, bot vẫn đang chạy ngầm.");
    }
}).listen(process.env.PORT || 3000);

// ========================================================
// 3. CẤU HÌNH CORE BOT (ANTI-LAG & ANTI-TIMEOUT)
// ========================================================
const botArgs = {
    host: 'QHykai.play.hosting', 
    port: 25565,                  
    username: 'tod', 
    version: '1.21.11', 
    checkTimeoutInterval: 120000 // Tăng lên 2 phút để tránh rớt mạng ảo trên Cloud
};

const PASSWORD = 'DucMinh2026@'; 
let botInstance = null;
let movementTimeout = null;
let updateInterval = null;
let reconnectTimeout = null;

function createBot() {
    // Khóa chống trùng luồng bot (Tránh tạo 2 con bot cùng lúc gây crash)
    if (botInstance) return;

    try {
        const bot = mineflayer.createBot(botArgs);
        botInstance = bot;

        // XỬ LÝ ĐĂNG NHẬP AN TOÀN
        bot.on('messagestr', (message) => {
            try {
                const msg = message.toLowerCase();
                if (msg.includes('/login') || msg.includes('đăng nhập')) {
                    setTimeout(() => { if (botInstance && typeof botInstance.chat === 'function') botInstance.chat(`/login ${PASSWORD}`); }, 2000);
                } 
                else if (msg.includes('/register') || msg.includes('đăng ký')) {
                    setTimeout(() => { if (botInstance && typeof botInstance.chat === 'function') botInstance.chat(`/register ${PASSWORD} ${PASSWORD}`); }, 2000);
                }
            } catch (e) {}
        });

        // KHI VÀO GAME THÀNH CÔNG
        bot.on('spawn', () => {
            try {
                botStatus.connected = "🟢 Đã tham gia server thành công!";
                if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
                if (movementTimeout) { clearTimeout(movementTimeout); movementTimeout = null; }
                
                startRandomMovement(bot);

                // VÒNG LẶP CẬP NHẬT DỮ LIỆU SẠCH (CHỐNG TRÀN BỘ NHỚ)
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(() => {
                    try {
                        if (!bot || !bot.entity) return;

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
                            for (const entityName in bot.entities) {
                                const entity = bot.entities[entityName];
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
            } catch (spawnErr) {}
        });

        // 💀 TỰ ĐỘNG HỒI SINH SAU ĐÚNG 1 GIÂY (CHỐNG KẸT LUỒNG CHẾT)
        bot.on('death', () => {
            setTimeout(() => { 
                try {
                    if (botInstance && typeof botInstance.respawn === 'function') {
                        botInstance.respawn(); 
                    }
                } catch (e) {}
            }, 1000);
        });

        // ⏱️ CHỜ ĐÚNG 3 GIÂY ĐỂ SERVER THỰC HIỆN XONG QUY TRÌNH KICK/FREEZE RỒI MỚI JOIN LẠI
        bot.on('kicked', () => { triggerReconnect(3000); });
        bot.on('end', () => { triggerReconnect(3000); });
        bot.on('error', () => { triggerReconnect(3000); });

    } catch (e) {
        triggerReconnect(3000);
    }
}

// HÀM ĐIỀU HƯỚNG KẾT NỐI LẠI TẬP TRUNG (BẤT KHẢ THI BỊ TRÙNG LUỒNG)
function triggerReconnect(delay) {
    cleanUp();
    if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            createBot();
        }, delay);
    }
}

// DỌN DẸP BỘ NHỚ ĐỆM CHỐNG RÒ RỈ TÀI NGUYÊN (MEMORY LEAK)
function cleanUp() {
    try { if (movementTimeout) clearTimeout(movementTimeout); } catch(e) {}
    try { if (updateInterval) clearInterval(updateInterval); } catch(e) {}
    
    movementTimeout = null;
    updateInterval = null;
    
    if (botInstance) {
        try { botInstance.quit(); } catch(e) {}
        botInstance = null;
    }
    botStatus.connected = "🔴 Đang đóng băng mạng / Tự động kết nối lại sau 3s...";
    botStatus.gameMode = "Không rõ";
    botStatus.nearbyPlayers = [];
}

// DI CHUYỂN NGẪU NHIÊN GIỮ CHUNK (BỌC TRY-CATCH TOÀN DIỆN)
function startRandomMovement(bot) {
    if (!bot || !bot.entity || !botInstance) return;
    try {
        const actions = ['forward', 'back', 'left', 'right', 'jump'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        if (typeof bot.setControlState === 'function') {
            bot.setControlState(action, true);
        }

        setTimeout(() => {
            try {
                if (botInstance && bot && typeof bot.clearControlStates === 'function') {
                    bot.clearControlStates();
                    movementTimeout = setTimeout(() => startRandomMovement(bot), 15000 + Math.random() * 5000);
                }
            } catch(e) {}
        }, 1000);
    } catch (e) {}
}

// KHỞI CHẠY HỆ THỐNG IMMORTAL
createBot();
