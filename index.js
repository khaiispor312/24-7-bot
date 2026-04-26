const mineflayer = require('mineflayer');
const http = require('http');

// --- CẤU HÌNH ---
const SERVER_IP = 'minhducz.play.hosting';
const BOT_NAME = 'Vertex';
const MK = 'mk625627255';
const PORT = process.env.PORT || 8080; // Cực kỳ quan trọng để Render không kill bot

// --- TẠO WEB SERVER (Để UptimeRobot "ping") ---
http.createServer((req, res) => {
    res.write("Bot is Alive!");
    res.end();
}).listen(PORT, () => {
    console.log(`Web Server đang chạy trên cổng ${PORT}`);
});

function createBot() {
    const bot = mineflayer.createBot({
        host: SERVER_IP,
        username: BOT_NAME,
        version: false // Tự dò port và version
    });

    // Vượt rào AuthMe sau 1 giây
    bot.on('spawn', () => {
        console.log(`[${new Date().toLocaleTimeString()}] Bot đã kết nối!`);
        setTimeout(() => {
            bot.chat(`/register ${MK} ${MK}`);
            bot.chat(`/login ${MK}`);
        }, 1000);

        // Logic quậy phá chống AFK
        const afk = setInterval(() => {
            bot.setControlState('jump', true);
            setTimeout(() => bot.clearControlStates(), 1000);
        }, 30000);
        
        bot.once('end', () => clearInterval(afk));
    });

    // Tự động hồi sinh
    bot.on('death', () => bot.respawn());

    // Tự động Restart khi mất kết nối
    bot.on('end', () => {
        console.log("Mất kết nối server Minecraft. Đang khởi động lại...");
        setTimeout(() => process.exit(), 5000);
    });

    // Chống sập khi gặp lỗi
    bot.on('error', (err) => {
        console.error('Lỗi:', err.message);
        setTimeout(() => process.exit(), 10000);
    });
}

createBot();

// Chống crash toàn hệ thống
process.on('uncaughtException', (err) => {
    console.error('Crash hệ thống:', err);
    process.exit(1);
});
