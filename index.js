const mineflayer = require('mineflayer');
const http = require('http');
const dns = require('dns');

// 1. TẠO WEB SERVER ĐỂ TREO 24/7 TRÊN RENDER
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Vertex Final is Online 24/7. Monitoring MinhDucz SMP...');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web server đang chạy tại port ${PORT}`);
});

// 2. CẤU HÌNH BOT
const DOMAIN = 'minhducz.play.hosting';
const PASS = '12345678'; // Mật khẩu của ông

let bot;

function createBot() {
    // Tự động dò port để không bao giờ bị sai địa chỉ
    dns.resolveSrv(`_minecraft._tcp.${DOMAIN}`, (err, addresses) => {
        const finalPort = (!err && addresses.length > 0) ? addresses[0].port : 28610;

        bot = mineflayer.createBot({
            host: DOMAIN,
            port: finalPort,
            username: 'Vertex2',
            version: false, // Tự động khớp version server
            hideErrors: true // Tránh spam lỗi làm tràn console Render
        });

        // 3. LOGIC AUTHME & CHAT (Register + Login)
        bot.on('messagestr', (message) => {
            const msg = message.toLowerCase();
            if (msg.includes('/login') || msg.includes('đăng nhập')) {
                bot.chat(`/login ${PASS}`);
                console.log('🔑 Đã thực hiện Login.');
            } else if (msg.includes('/register') || msg.includes('đăng ký')) {
                bot.chat(`/register ${PASS} ${PASS}`);
                console.log('📝 Đã thực hiện Register.');
            }
        });

        bot.on('spawn', () => {
            console.log(`🚀 Vertex đã hạ cánh tại port ${finalPort}!`);
            // Đợi 5 giây cho server load rồi mới bắt đầu di chuyển
            setTimeout(loopMovement, 5000);
        });

        // 4. LOGIC NGƯỜI THẬT (Mô phỏng 100%)
        function randomMovement() {
            if (!bot || !bot.entity) return;

            const r = Math.random();
            
            // Player thật: Đi bộ, Nhảy, Sneak, Nhìn quanh
            if (r < 0.4) {
                // ĐI DẠO PHỨC TẠP
                const yaw = Math.random() * Math.PI * 2;
                bot.look(yaw, 0, true);
                bot.setControlState('forward', true);
                if (Math.random() > 0.7) bot.setControlState('jump', true);
                
                setTimeout(() => { if(bot) bot.clearControlStates(); }, Math.random() * 3000 + 1000);
            } else if (r < 0.7) {
                // SOI MAP (Nhìn lên xuống, xoay đầu như đang quan sát)
                const targetYaw = Math.random() * Math.PI * 2;
                const targetPitch = (Math.random() - 0.5) * 1;
                bot.look(targetYaw, targetPitch, false);
                
                if (Math.random() > 0.8) {
                    bot.setControlState('sneak', true);
                    setTimeout(() => { if(bot) bot.setControlState('sneak', false); }, 800);
                }
            } else {
                // ĐỨNG IM (Như đang đọc chat hoặc chỉnh setting)
                bot.clearControlStates();
            }
        }

        function loopMovement() {
            if (!bot) return;
            randomMovement();
            // Thời gian nghỉ ngẫu nhiên từ 5-12 giây
            const nextTick = Math.floor(Math.random() * 7000) + 5000;
            setTimeout(loopMovement, nextTick);
        }

        // 5. CHỐNG SẬP (Auto Respawn & Retry)
        bot.on('death', () => {
            console.log('💀 Bot tử nạn, đang hồi sinh...');
            setTimeout(() => { if(bot) bot.respawn(); }, 2000);
        });

        bot.on('end', (reason) => {
            console.log(`🔄 Mất kết nối (${reason}). Thử lại sau 10s...`);
            // Xóa bot cũ để giải phóng bộ nhớ trước khi tạo cái mới
            bot = null;
            setTimeout(createBot, 10000);
        });

        bot.on('error', (err) => {
            console.log('⚠️ Lỗi Bot:', err.message);
            if (err.code === 'ECONNREFUSED') {
                console.log('❌ Server đang offline.');
            }
        });
    });
}

// KHỞI CHẠY HỆ THỐNG
createBot();
