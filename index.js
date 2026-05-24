const mineflayer = require('mineflayer');
const http = require('http');

// 1. CHẶN HOÀN TOÀN VIỆC CRASH CODE TRÊN CLOUD
process.on('uncaughtException', (err) => {
    // Chỉ ghi nhận lỗi nghiêm trọng ngầm, không spam log rác
});
process.on('unhandledRejection', (reason, promise) => {
    // Chặn lỗi bất đồng bộ âm thầm
});

// 2. WEB SERVER GIỮ BOT ONLINE TRÊN RENDER (IM LẶNG 100%)
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Vertex System: Immortal Mode ON');
}).listen(process.env.PORT || 3000);

// 3. CẤU HÌNH BOT CHUẨN 1.21.6
const botArgs = {
    host: 'minhducz.play.hosting', 
    port: 25565,                  
    username: 'dot', // Đổi tên thành con bot 'dot' theo ý Đức nha
    version: '1.21.6', // Khóa cứng phiên bản 1.21.6 để Mineflayer tối ưu giao thức mạng
    checkTimeoutInterval: 90000 // Tăng thời gian timeout đề phòng mạng cloud bị delay
};

const PASSWORD = 'DucMinh2026@'; 
let botInstance = null;
let movementTimeout = null;

function createBot() {
    if (botInstance) return;

    try {
        const bot = mineflayer.createBot(botArgs);
        botInstance = bot;

        // TỰ ĐỘNG LOGIN/REGISTER (CHẠY NGẦM)
        bot.on('messagestr', (message) => {
            const msg = message.toLowerCase();
            if (msg.includes('/login') || msg.includes('đăng nhập')) {
                setTimeout(() => { if (bot && bot.chat) bot.chat(`/login ${PASSWORD}`); }, 2000);
            } 
            else if (msg.includes('/register') || msg.includes('đăng ký')) {
                setTimeout(() => { if (bot && bot.chat) bot.chat(`/register ${PASSWORD} ${PASSWORD}`); }, 2000);
            }
        });

        // KHI BOT VÀO SERVER THÀNH CÔNG
        bot.on('spawn', () => {
            // Xóa bộ đếm di chuyển cũ nếu có để tránh trùng luồng gây lag
            if (movementTimeout) clearTimeout(movementTimeout);
            startRandomMovement(bot);
        });

        // TỰ ĐỘNG HỒI SINH LẬP TỨC (1 GIÂY)
        bot.on('death', () => {
            setTimeout(() => { 
                if (botInstance && typeof botInstance.respawn === 'function') {
                    botInstance.respawn(); 
                }
            }, 1000);
        });

        // TỰ ĐỘNG KẾT NỐI LẠI KHI OUT (10 GIÂY)
        bot.on('end', () => {
            if (movementTimeout) clearTimeout(movementTimeout);
            botInstance = null;
            setTimeout(createBot, 10000);
        });

        // BẮT LỖI NỘI BỘ
        bot.on('error', () => {
            if (movementTimeout) clearTimeout(movementTimeout);
            botInstance = null;
            setTimeout(createBot, 10000);
        });

    } catch (e) {
        botInstance = null;
        setTimeout(createBot, 10000);
    }
}

// CHẾ ĐỘ DI CHUYỂN NGẪU NHIÊN ĐỂ GIỮ CHUNK (KHÔNG SPAM LOG)
function startRandomMovement(bot) {
    if (!bot || !bot.entity || !botInstance) return;
    try {
        const actions = ['forward', 'back', 'left', 'right', 'jump'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        bot.setControlState(action, true);

        // Giữ phím di chuyển trong 1 giây rồi buông
        setTimeout(() => {
            if (botInstance && bot.clearControlStates) {
                bot.clearControlStates();
                // Loop lại sau một khoảng thời gian ngẫu nhiên từ 15-20 giây
                movementTimeout = setTimeout(() => startRandomMovement(bot), 15000 + Math.random() * 5000);
            }
        }, 1000);
    } catch (e) {
        // Bỏ qua nếu có lỗi vật lý trong game
    }
}

// KHỞI CHẠY HỆ THỐNG
createBot();
