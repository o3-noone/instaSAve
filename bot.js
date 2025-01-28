const { exec } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Bot tokeningizni kiriting
const TOKEN = '5159228470:AAG84AU6YOxcGwV00NzaLSWpUymHwwdSDG4';
const bot = new TelegramBot(TOKEN, { polling: true });

// Yuklash uchun katalogni sozlash
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Katalogni tekshirish yoki yaratish
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR);
}

// URL dan qo'shimcha parametrlarni olib tashlash funksiyasi
function cleanUrl(url) {
    const match = url.match(/https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/);
    return match ? match[0] : null;
}

// Instagram videosini va tasvirini yuklash funksiyasi
async function downloadInstagramPost(url, chatId) {
    try {
        // URL ni tozalash
        const cleanUrlResult = cleanUrl(url);
        if (!cleanUrlResult) {
            bot.sendMessage(chatId, '❌ Noto‘g‘ri Instagram havolasi.');
            return;
        }

        // Yangi tozalangan URL bilan buyruqni ishga tushirish
        const command = `yt-dlp ${cleanUrlResult} --write-thumbnail -o "${DOWNLOADS_DIR}/%(id)s.%(ext)s"`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                bot.sendMessage(chatId, `❌ Yuklashda xato yuz berdi: ${err.message}`);
                return;
            }

            // Yuklangan faylni qidirish
            fs.readdir(DOWNLOADS_DIR, (err, files) => {
                if (err) {
                    console.error('Katalog o\'qishda xato:', err);
                    bot.sendMessage(chatId, '❌ Faylni topishda xato yuz berdi.');
                    return;
                }

                const downloadedFile = files.find(file => file.endsWith('.mp4') || file.endsWith('.jpg') || file.endsWith('.png'));
                if (downloadedFile) {
                    bot.sendMessage(chatId, `✅ Fayl muvaffaqiyatli yuklandi: ${downloadedFile}`);
                } else {
                    bot.sendMessage(chatId, '❌ Yuklangan fayl topilmadi.');
                }
            });
        });
    } catch (err) {
        console.error('Instagram Video Download Error:', err);
        bot.sendMessage(chatId, '❌ Instagram videoni yoki postni yuklashda xato yuz berdi.');
    }
}

// Bot buyruqlari
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '👋 Salom! Instagram yoki TikTok video yoki post havolasini yuboring, men uni yuklab beraman.');
});

// TikTok va Instagram havolalarini tekshirish uchun regex
const instagramPattern = /https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/;

// Foydalanuvchi yuborgan xabarni qabul qilish va tekshirish
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (instagramPattern.test(text)) {
        bot.sendMessage(chatId, '⏳ Instagram videosi yoki postini yuklashni boshlayapman...');
        downloadInstagramPost(text, chatId);
    } else if (!text.startsWith('/')) {
        bot.sendMessage(chatId, '❌ Iltimos, haqiqiy Instagram havolasini yuboring.');
    }
});

// /file buyruqi: downloads ichidagi fayllarni ko'rsatish va delete tugmasini qo'shish
bot.onText(/\/file/, (msg) => {
    const chatId = msg.chat.id;

    fs.readdir(DOWNLOADS_DIR, (err, files) => {
        if (err) {
            console.error('Katalogni o\'qishda xato:', err);
            bot.sendMessage(chatId, '❌ Katalogni o\'qishda xato yuz berdi.');
            return;
        }

        if (files.length === 0) {
            bot.sendMessage(chatId, '❌ Katalogda hech qanday fayl yo\'q.');
        } else {
            const inlineKeyboard = [];

            // Fayllar ro'yxatini va delete tugmalarini yaratish
            files.forEach(file => {
                inlineKeyboard.push([{
                    text: `📄 ${file}`,
                    callback_data: `delete_${file}`
                }]);
            });

            bot.sendMessage(chatId, `📂 Downloads papkasidagi fayllar:\n${files.join('\n')}`, {
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });
        }
    });
});


// Faylni o'chirish
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const action = callbackQuery.data;

    if (action.startsWith('delete_')) {
        const fileName = action.replace('delete_', '');
        const filePath = path.join(DOWNLOADS_DIR, fileName);

        fs.unlink(filePath, (err) => {
            if (err) {
                bot.sendMessage(chatId, `❌ Faylni o'chirishda xato yuz berdi: ${err.message}`);
                return;
            }

            bot.sendMessage(chatId, `✅ ${fileName} fayli muvaffaqiyatli o'chirildi.`);

            // Inline tugmani yangilash
            bot.editMessageText(`📂 Downloads papkasidagi fayllar:\n${fs.readdirSync(DOWNLOADS_DIR).join('\n')}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: []
                }
            });
        });
    }
});
