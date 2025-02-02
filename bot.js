const { exec } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = '5159228470:AAG84AU6YOxcGwV00NzaLSWpUymHwwdSDG4'
const bot = new TelegramBot(TOKEN, { polling: true });

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR);
}

function cleanUrl(url) {
    const match = url.match(/https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/);
    return match ? match[0] : null;
}

async function downloadInstagramVideo(url, chatId) {
    try {
        const cleanUrlResult = cleanUrl(url);
        if (!cleanUrlResult) {
            bot.sendMessage(chatId, '❌ Noto‘g‘ri Instagram havolasi.');
            return;
        }

        const command = `yt-dlp -f mp4 ${cleanUrlResult} -o "${DOWNLOADS_DIR}/%(id)s.%(ext)s"`;
        
        exec(command, (err, stdout, stderr) => {
            if (err) {
                bot.sendMessage(chatId, `❌ Yuklashda xato yuz berdi: ${err.message}`);
                return;
            }

            fs.readdir(DOWNLOADS_DIR, (err, files) => {
                if (err) {
                    bot.sendMessage(chatId, '❌ Faylni topishda xato yuz berdi.');
                    return;
                }

                const downloadedFile = files.find(file => file.endsWith('.mp4'));
                if (downloadedFile) {
                    const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
                    bot.sendVideo(chatId, filePath)
                        .then(() => {
                            fs.unlink(filePath, (err) => {
                                if (!err) {
                                    console.log(`${downloadedFile} o‘chirildi.`);
                                }
                            });
                        })
                        .catch(err => bot.sendMessage(chatId, `❌ Video jo'natishda xato: ${err.message}`));
                } else {
                    bot.sendMessage(chatId, '❌ Faqat video fayl (.mp4) topilmadi.');
                }
            });
        });
    } catch (err) {
        bot.sendMessage(chatId, '❌ Instagram videoni yuklashda xato yuz berdi.');
    }
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '👋 Salom! Instagram video havolasini yuboring, men uni yuklab beraman.');
});

const instagramPattern = /https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/;

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (instagramPattern.test(text)) {
        bot.sendMessage(chatId, '⏳ Instagram videosini yuklashni boshlayapman...');
        downloadInstagramVideo(text, chatId);
    } else if (!text.startsWith('/')) {
        bot.sendMessage(chatId, '❌ Iltimos, haqiqiy Instagram video havolasini yuboring.');
    }
});