const mineflayer = require('mineflayer');
const http = require('http');

// 1. TẠO WEB SERVER ĐỂ TREO 24/7 TRÊN RENDER
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is Alive! MinhDucz SMP is running 24/7.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web server đang chạy tại port ${PORT}`);
});

// 2. CẤU HÌNH BOT MINECRAFT
const botArgs = {
    host: 'minhducz.play.hosting',
    port: 25565, // Đảm bảo port này đúng với server của ông
    username: 'Vertex',
    version: '1.21.6' // Chỉnh đúng version server đang chạy
};

let bot;

function createBot() {
    bot = mineflayer.createBot(botArgs);

    // Tự động đăng nhập AuthMe
    bot.on('spawn', () => {
        console.log('Bot đã vào server!');
        bot.chat('/login 12345678'); // Thay mật khẩu của ông vào đây
        loopMovement(); // Kích hoạt chế độ tăng động
    });

    // Chế độ Tăng Động (Movement & Look)
    function randomMovement() {
        const actions = ['forward', 'back', 'left', 'right', 'jump'];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        const randomTime = Math.floor(Math.random() * 1500) + 500;

        bot.setControlState(randomAction, true);
        
        // Xoay đầu ngẫu nhiên
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * Math.PI;
        bot.look(yaw, pitch, false);

        setTimeout(() => {
            bot.clearControlStates();
        }, randomTime);
    }

    function loopMovement() {
        if (!bot) return;
        randomMovement();
        // Cứ mỗi 15-25 giây lại vận động một lần
        const nextTick = Math.floor(Math.random() * 10000) + 15000;
        setTimeout(loopMovement, nextTick);
    }

    // Tự động hồi sinh khi chết
    bot.on('death', () => {
        console.log('Bot bị tiêu diệt, đang hồi sinh...');
        bot.respawn();
    });

    // Tự động kết nối lại khi bị văng (Crash/Kick)
    bot.on('end', () => {
        console.log('Bot bị mất kết nối, đang thử lại sau 10 giây...');
        setTimeout(createBot, 10000);
    });

    bot.on('error', (err) => console.log('Lỗi Bot:', err));
}

// Chạy bot
createBot();
