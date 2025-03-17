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
    return title.replace(/[\\/:*?"<>|]/g, ''); // Maxsus belgilarni olib tashlash
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

        // Prevyu rasmini yuklash (png formatida)
        const thumbnailCommand = `yt-dlp --skip-download --write-thumbnail --convert-thumbnails png -o "${DOWNLOADS_DIR}/%(title)s.%(ext)s" ${cleanUrlResult}`;
        
        exec(thumbnailCommand, async (err) => {
            if (err) {
                bot.sendMessage(chatId, '❌ Prevyu rasmini yuklashda xato yuz berdi.');
                return;
            }

            // Prevyu rasmini topish
            const files = fs.readdirSync(DOWNLOADS_DIR);
            const thumbnailFile = files.find(file => file.endsWith('.png'));

            if (thumbnailFile) {
                const thumbnailPath = path.join(DOWNLOADS_DIR, thumbnailFile);

                // Prevyu rasmini Telegramga yuborish
                await bot.sendPhoto(chatId, thumbnailPath);

                // Prevyu rasmini o'chirish
                fs.unlinkSync(thumbnailPath);

                // Agar havola Shorts bo'lsa, to'liq videoni yuklash
                if (cleanUrlResult.includes('/shorts/')) {
                    const progressMessage = await bot.sendMessage(chatId, '⏳ YouTube Shorts videosini yuklanyapti...');

                    // Video yuklashni boshlash (mp4 formatida)
                    const videoCommand = `yt-dlp -f bestvideo+bestaudio --merge-output-format mp4 ${cleanUrlResult} -o "${DOWNLOADS_DIR}/${cleanTitle}.%(ext)s" --newline --restrict-filenames`;
                    const process = exec(videoCommand);

                    let downloadedBytes = 0;
                    let totalBytes = 0;

                    process.stdout.on('data', (data) => {
                        const progressMatch = data.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+~?(\d+\.\d+)(\w+)\s+at/);
                        if (progressMatch) {
                            const percent = parseFloat(progressMatch[1]);
                            const size = parseFloat(progressMatch[2]);
                            const unit = progressMatch[3];

                            const currentBytes = size * (unit === 'MiB' ? 1024 * 1024 : unit === 'KiB' ? 1024 : 1);
                            totalBytes = totalBytes || currentBytes / (percent / 100);

                            if (currentBytes - downloadedBytes >= 5 * 1024 * 1024) {
                                bot.editMessageText(`📥 Yuklangan: ${percent.toFixed(2)}% (${(currentBytes / (1024 * 1024)).toFixed(2)} MB)`, {
                                    chat_id: chatId,
                                    message_id: progressMessage.message_id,
                                });
                                downloadedBytes = currentBytes;
                            }
                        }
                    });

                    process.stderr.on('data', (data) => {
                        console.error(`stderr: ${data}`);
                        bot.sendMessage(chatId, `❌ Xato: ${data}`);
                    });

                    process.on('close', (code) => {
                        if (code === 0) {
                            const files = fs.readdirSync(DOWNLOADS_DIR);
                            const downloadedFile = files.find(file => file.startsWith(cleanTitle) && file.endsWith('.mp4'));

                            if (downloadedFile) {
                                const filePath = path.join(DOWNLOADS_DIR, downloadedFile);

                                // Video faylini yuborish (video nomi bilan)
                                bot.sendVideo(chatId, filePath, { caption: videoTitle })
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
                } else {
                    // Agar havola Shorts bo'lmasa, faqat prevyu rasmini yuborish
                    bot.sendMessage(chatId, '✅ Prevyu rasmi muvaffaqiyatli yuborildi. Faqat YouTube Shorts havolalari uchun to‘liq video yuklanadi.');
                }
            } else {
                bot.sendMessage(chatId, '❌ Prevyu rasmi topilmadi.');
            }
        });
    } catch (err) {
        bot.sendMessage(chatId, '❌ YouTube videoni yuklashda xato yuz berdi.');
    }
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '👋 Salom! YouTube video havolasini yuboring. Agar bu YouTube Shorts bo‘lsa, to‘liq videoni yuklab beraman, aks holda faqat prevyu rasmini yuboraman.');
});

const youtubePattern = /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[A-Za-z0-9_-]+/;

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (youtubePattern.test(text)) {
        bot.sendMessage(chatId, '⏳ YouTube videosini tahlil qilayapman...');
        downloadYouTubeVideo(text, chatId);
    } else if (!text.startsWith('/')) {
        bot.sendMessage(chatId, '❌ Iltimos, haqiqiy YouTube video havolasini yuboring.');
    }
});