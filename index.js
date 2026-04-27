const mineflayer = require('mineflayer');
const http = require('http');

// 1. CHẶN HOÀN TOÀN VIỆC CRASH CODE (GIÁP BẢO VỆ RENDER)
process.on('uncaughtException', (err) => {
    console.log('🛡️ Đã chặn một lỗi gây Crash: ', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.log('🛡️ Đã chặn một lỗi hứa hẹn (Promise) bị từ chối.');
});

// 2. WEB SERVER GIỮ BOT ONLINE
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Vertex System: Immortal Mode ON');
}).listen(process.env.PORT || 3000);

// 3. CẤU HÌNH
const botArgs = {
    host: 'minhducz.play.hosting', 
    port: 25565,                  
    username: 'Vertex',
    version: false,               
    checkTimeoutInterval: 60000   
};

const PASSWORD = 'DucMinh2026@'; 
let botInstance = null;

function createBot() {
    if (botInstance) return;

    // Chèn thêm một chút try-catch khi khởi tạo
    try {
        const bot = mineflayer.createBot(botArgs);
        botInstance = bot;

        // TỰ ĐỘNG LOGIN/REGISTER
        bot.on('messagestr', (message) => {
            const msg = message.toLowerCase();
            if (msg.includes('/login') || msg.includes('đăng nhập')) {
                setTimeout(() => { if (bot && bot.chat) bot.chat(`/login ${PASSWORD}`); }, 3000);
            } 
            else if (msg.includes('/register') || msg.includes('đăng ký')) {
                setTimeout(() => { if (bot && bot.chat) bot.chat(`/register ${PASSWORD} ${PASSWORD}`); }, 3000);
            }
        });

        bot.on('spawn', () => {
            console.log('🚀 Vertex đã vào server!');
            startRandomMovement(bot);
        });

        // AUTO RESPAWN (1 GIÂY)
        bot.on('death', () => {
            setTimeout(() => { if (botInstance) botInstance.respawn(); }, 1000);
        });

        // AUTO RETRY (10 GIÂY)
        bot.on('end', (reason) => {
            console.log(`🔄 Ngắt kết nối: ${reason}. Thử lại sau 10s...`);
            botInstance = null;
            setTimeout(createBot, 10000);
        });

        // BẮT LỖI RIÊNG CHO BOT (KHÔNG ĐỂ VĂNG RA NGOÀI)
        bot.on('error', (err) => {
            console.log('⚠️ Lỗi bot nội bộ:', err.message);
            botInstance = null;
            setTimeout(createBot, 10000);
        });

    } catch (e) {
        console.log('⚠️ Lỗi khi khởi tạo bot, đang thử lại...');
        botInstance = null;
        setTimeout(createBot, 10000);
    }
}

// CHẾ ĐỘ DI CHUYỂN TĂNG ĐỘNG
function startRandomMovement(bot) {
    if (!bot || !bot.entity || !botInstance) return;
    try {
        const actions = ['forward', 'back', 'left', 'right', 'jump', 'sneak'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        bot.setControlState(action, true);
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * Math.PI;
        bot.look(yaw, pitch, false);

        setTimeout(() => {
            if (bot && bot.clearControlStates) {
                bot.clearControlStates();
                setTimeout(() => startRandomMovement(bot), 15000 + Math.random() * 5000);
            }
        }, 1500);
    } catch (e) {
        console.log('⚠️ Lỗi di chuyển, đang bỏ qua...');
    }
}

// KHỞI CHẠY
createBot();
