const { cmd } = require("../command");
const axios = require("axios");
const NodeCache = require('node-cache');

cmd({
  pattern: "movie2",
  category: "movie",
  desc: "Search Sinhala subtitle movies",
  use: ".movie2 <movie name>",
  react: "🎬"
}, async (m, conn, { q, prefix }) => {
  try {
    if (!q) return m.reply("⚠️ නමක් ඇතුළත් කරන්න (E.g. `.movie2 avatar 2009`)");

    const searchUrl = `https://www.dark-yasiya-api.site/movie/sinhalasub/search?text=${encodeURIComponent(q)}`;

    // Retry-enabled fetcher
    const fetchData = async (url, retries = 5) => {
      try {
        const { data } = await axios.get(url);
        return data;
      } catch (err) {
        if (retries === 0) throw err;
        return await fetchData(url, retries - 1);
      }
    };

    const searchRes = await fetchData(searchUrl);
    const movieList = searchRes?.result?.data;

    if (!movieList || movieList.length === 0) {
      return m.reply("⚠️ සොයාගත නොහැක. අවුරුද්ද ඇතුළත් කරන්න (E.g. `.movie2 iron man 2008`)");
    }

    const topMovies = movieList.slice(0, 20);
    const movieText = topMovies.map((movie, i) => `${i + 1}. 🎬 *${movie.title} (${movie.year})*`).join("\n");

    const msg = `🎥 *Sinhala Subtitle Search Results*\n\n🔎 *Search:* ${q}\n\n${movieText}\n\n📝 *Reply with a number (1-${topMovies.length}) to select movie.*`;

    const promptMsg = await conn.sendMessage(m.chat, { text: msg }, { quoted: m });

    conn.ev.once("messages.upsert", async ({ messages }) => {
      const userReply = messages[0];

      const text = userReply?.message?.conversation || userReply?.message?.extendedTextMessage?.text;
      const isReply = userReply?.message?.extendedTextMessage?.contextInfo?.stanzaId === promptMsg.key.id;

      if (!/^\d+$/.test(text) || !isReply) return;

      const index = parseInt(text) - 1;
      if (index < 0 || index >= topMovies.length) {
        return m.reply("❌ වැරදි අංකයකි. 1-20 අතර අංකයක් reply කරන්න.");
      }

      const selected = topMovies[index];
      const detailUrl = `https://www.dark-yasiya-api.site/movie/sinhalasub/movie?url=${selected.link}`;

      const detailRes = await fetchData(detailUrl);
      const info = detailRes?.result?.data;
      if (!info) return m.reply("❌ Film Detail ලබාගැනීමට අසාර්ථකයි.");

      const links = info.dl_links.map(dl => dl.link.replace("/u/", "/api/file/"));
      const sizes = info.dl_links.map(dl => dl.size || "N/A");

      let details = `🎬 *${info.title || "Unknown"}*\n📆 ${info.date || "N/A"}\n⭐ IMDb: ${info.imdbRate || "N/A"}\n🌍 ${info.country || "N/A"}\n🕒 ${info.runtime || "N/A"}\n\n`;
      details += `🧾 *Download Options:*\n2.1 🎥 480p - ${sizes[2]}\n2.2 🎥 720p - ${sizes[1]}\n2.3 🎥 1080p - ${sizes[0]}\n\n📌 *Reply with 2.1 / 2.2 / 2.3*`;

      await conn.sendMessage(m.chat, { image: { url: info.images[0] }, caption: details }, { quoted: m });

      conn.ev.once("messages.upsert", async ({ messages }) => {
        const opt = messages[0];
        const replyText = opt?.message?.conversation || opt?.message?.extendedTextMessage?.text;

        let chosenIndex = { "2.1": 2, "2.2": 1, "2.3": 0 }[replyText];
        if (chosenIndex == null) return;

        await conn.sendMessage(m.chat, {
          document: { url: links[chosenIndex] },
          fileName: `🎬 ${info.title}`,
          mimetype: "video/mp4",
          caption: `🎞️ *${info.title}*\n📦 Quality: ${replyText.toUpperCase()}\n\n> Powered by CHALAH X BOT V3`
        }, { quoted: opt });
      });
    });

  } catch (err) {
    console.error(err);
    return m.reply(`❌ දෝෂයක් ඇතිවිය: ${err.message || err}`);
  }
});
