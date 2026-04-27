const mineflayer = require('mineflayer');
const http = require('http');

// 1. WEB SERVER GIỮ BOT ONLINE 24/7 TRÊN RENDER
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Vertex System is Online');
}).listen(process.env.PORT || 3000);

// 2. CẤU HÌNH (Ông thay đổi ở đây)
const botArgs = {
    host: 'minhducz.play.hosting', 
    port: 25565,                  
    username: 'Vertex',
    version: false,               // Để false để nó tự khớp với Paper 1.21.6
    checkTimeoutInterval: 60000   // Tăng thời gian chờ để chống lag đường truyền
};

const PASSWORD = 'DucMinh2026@'; // Mật khẩu tự đặt

function createBot() {
    const bot = mineflayer.createBot(botArgs);

    // 3. TỰ ĐỘNG REGISTER & LOGIN (Có độ trễ tránh bị kick)
    bot.on('messagestr', (message) => {
        const msg = message.toLowerCase();
        
        // Nếu thấy yêu cầu Login
        if (msg.includes('/login') || msg.includes('đăng nhập')) {
            setTimeout(() => {
                bot.chat(`/login ${PASSWORD}`);
                console.log('🔑 Đã gửi lệnh Login');
            }, 2000); // Đợi 2 giây mới chat cho giống người
        } 
        
        // Nếu thấy yêu cầu Register
        else if (msg.includes('/register') || msg.includes('đăng ký')) {
            setTimeout(() => {
                bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
                console.log('📝 Đã gửi lệnh Register');
            }, 2000);
        }
    });

    bot.on('spawn', () => {
        console.log('🚀 Vertex đã vào server thành công!');
        startRandomMovement(bot);
    });

    // 4. LOGIC DI CHUYỂN TỰ ĐỘNG (Real Player)
    function startRandomMovement(bot) {
        if (!bot || !bot.entity) return;

        const actions = ['forward', 'back', 'left', 'right', 'jump', 'sneak'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        // Thực hiện hành động
        bot.setControlState(action, true);
        
        // Xoay đầu ngẫu nhiên
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * Math.PI;
        bot.look(yaw, pitch, false);

        // Giữ hành động trong 1-2 giây rồi dừng
        setTimeout(() => {
            bot.clearControlStates();
            // Đợi 15-20 giây sau mới làm hành động tiếp theo cho đỡ lag
            setTimeout(() => startRandomMovement(bot), Math.random() * 5000 + 15000);
        }, Math.random() * 1000 + 1000);
    }

    // 5. AUTO RESPAWN (1 GIÂY)
    bot.on('death', () => {
        console.log('💀 Bot chết, đang hồi sinh sau 1s...');
        setTimeout(() => {
            if (bot) bot.respawn();
        }, 1000);
    });

    // 6. AUTO RETRY DISCONNECT (5 GIÂY)
    bot.on('end', (reason) => {
        console.log(`🔄 Mất kết nối: ${reason}. Thử lại sau 5s...`);
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
        console.log('⚠️ Lỗi kết nối:', err.message);
    });
}

// Khởi chạy
createBot();
