const { exec } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = '5159228470:AAG84AU6YOxcGwV00NzaLSWpUymHwwdSDG4';
const bot = new TelegramBot(TOKEN, { polling: true });

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true, mode: 0o777 });
}

function cleanUrl(url) {
    const match = url.match(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[A-Za-z0-9_-]+/);
    return match ? match[0] : null;
}

function cleanFileName(title) {
    return title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_'); // Bo'sh joylarni pastki chiziqcha bilan almashtirish
}

async function getVideoTitle(url) {
    return new Promise((resolve, reject) => {
        exec(`yt-dlp --get-title ${url}`, (err, stdout) => {
            if (err) {
                reject(err);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function downloadYouTubeVideo(url, chatId) {
    try {
        const cleanUrlResult = cleanUrl(url);
        if (!cleanUrlResult) {
            bot.sendMessage(chatId, '❌ Noto‘g‘ri YouTube havolasi.');
            return;
        }

        // Video nomini olish
        const videoTitle = await getVideoTitle(cleanUrlResult);
        const cleanTitle = cleanFileName(videoTitle);

        // Video yuklashni boshlash (eng yuqori sifatda)
        const videoCommand = `yt-dlp -f best ${cleanUrlResult} -o "${DOWNLOADS_DIR}/${cleanTitle}.%(ext)s" --restrict-filenames`;
        const process = exec(videoCommand);

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        process.on('close', (code) => {
            if (code === 0) {
                const files = fs.readdirSync(DOWNLOADS_DIR);
                const downloadedFile = files.find(file => file.startsWith(cleanTitle));

                if (downloadedFile) {
                    const filePath = path.join(DOWNLOADS_DIR, downloadedFile);

                    // Video faylini yuborish (asl formatida)
                    bot.sendDocument(chatId, filePath)
                        .then(() => {
                            // Video yuborilgandan so'ng faylni o'chirish
                            fs.unlinkSync(filePath);
                        })
                        .catch((err) => {
                            console.error('Video yuborishda xato:', err);
                            bot.sendMessage(chatId, '❌ Videoni yuborishda xato yuz berdi.');
                        });
                } else {
                    bot.sendMessage(chatId, '❌ Yuklangan fayl topilmadi.');
                }
            } else {
                bot.sendMessage(chatId, '❌ Yuklashda xato yuz berdi.');
            }
        });
    } catch (err) {
        bot.sendMessage(chatId, '❌ YouTube videoni yuklashda xato yuz berdi.');
    }
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '👋 Salom! YouTube video havolasini yuboring. Men uni yuklab, Telegramga yuboraman.');
});

const youtubePattern = /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[A-Za-z0-9_-]+/;

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (youtubePattern.test(text)) {
        downloadYouTubeVideo(text, chatId);
    } else if (!text.startsWith('/')) {
        bot.sendMessage(chatId, '❌ Iltimos, haqiqiy YouTube video havolasini yuboring.');
    }
});