const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const rankRoles = {
  Copper: "1480521392440217713",
  Bronze: "1480521364761874617",
  Silver: "1480521337238847499",
  Gold: "1480521305836224532",
  Platinum: "1480521278363406436",
  Emerald: "1480521232221995063",
  Diamond: "1480521170020204631",
  Champion: "1480521117499134076",
  Unranked: "1482408882306416803",
  RankVerified: "1512812744762462238"
};

const rankIcons = {
  Copper: "https://cdn.discordapp.com/attachments/1513166409348153344/1513166983934246912/30392-copper.png",
  Bronze: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167008168935606/50972-bronze.png",
  Silver: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167017425768568/54401-silver.png",
  Gold: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167028482080899/16646-gold.png",
  Platinum: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167043136852131/93489-rainbowsixsigeplatinum.png",
  Emerald: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167055984005120/94972-emerald.png",
  Diamond: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167072002052116/6436-rainbowsixsiegediamond.png",
  Champion: "https://cdn.discordapp.com/attachments/1513166409348153344/1513167073944277072/6679-r6champ.png",
  Unranked: "https://cdn.discordapp.com/attachments/1513166409348153344/1513166983934246912/30392-copper.png"
};

const rankColors = {
  Copper: 0x9c6b30,
  Bronze: 0xcd7f32,
  Silver: 0xc0c0c0,
  Gold: 0xffd700,
  Platinum: 0x00d4ff,
  Emerald: 0x2ecc71,
  Diamond: 0x9b59b6,
  Champion: 0xff2f8f,
  Unranked: 0x808080
};

function isValidStatsCCUrl(url) {
  return url && url.startsWith("https://stats.cc/siege/");
}

function extractPlayerName(profileUrl) {
  try {
    const url = new URL(profileUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[1] || "Unknown Player";
  } catch {
    return "Unknown Player";
  }
}

function findHighestRank(text) {
  const ranks = [
    "Champion",
    "Diamond",
    "Emerald",
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
    "Copper"
  ];

  for (const rank of ranks) {
    if (text.toLowerCase().includes(rank.toLowerCase())) {
      return rank;
    }
  }

  return "Unranked";
}

async function getStatsFromStatsCC(profileUrl) {
  const response = await axios.get(profileUrl, {
    timeout: 12000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Referer": "https://stats.cc/",
      "Cache-Control": "no-cache"
    }
  });

  const $ = cheerio.load(response.data);
  const pageText = $("body").text().replace(/\s+/g, " ").trim();

  let maxRank = "Unranked";
  let kd = "N/A";

  const maxRanksMatch = pageText.match(/Max Ranks(.{0,700})/i);

  if (maxRanksMatch) {
    maxRank = findHighestRank(maxRanksMatch[1]);
  }

  const kdMatch = pageText.match(/KD\s*([0-9]+(?:\.[0-9]+)?)/i);

  if (kdMatch) {
    kd = kdMatch[1];
  }

  if (maxRank === "Unranked") {
    maxRank = findHighestRank(pageText);
  }

  return {
    maxRank,
    kd
  };
}

async function assignRankRole(member, rank) {
  const rankOnlyRoleIds = [
    rankRoles.Copper,
    rankRoles.Bronze,
    rankRoles.Silver,
    rankRoles.Gold,
    rankRoles.Platinum,
    rankRoles.Emerald,
    rankRoles.Diamond,
    rankRoles.Champion,
    rankRoles.Unranked
  ];

  const rolesToRemove = member.roles.cache.filter(role =>
    rankOnlyRoleIds.includes(role.id)
  );

  if (rolesToRemove.size > 0) {
    await member.roles.remove(rolesToRemove);
  }

  const roleId = rankRoles[rank];

  if (!roleId) {
    throw new Error(`No role ID set for rank: ${rank}`);
  }

  await member.roles.add(roleId);
  await member.roles.add(rankRoles.RankVerified);
}

function buildVerificationReminderEmbed() {
  return new EmbedBuilder()
    .setColor(0xff2f8f)
    .setAuthor({ name: "SiegeVerify" })
    .setTitle("Verify Your Rainbow Six Siege Rank")
    .setDescription(
      "Use `/verify` and paste your Stats.cc Siege profile URL to receive your ranked role."
    )
    .setThumbnail(rankIcons.Champion)
    .addFields(
      {
        name: "How to verify",
        value: "`/verify profileurl:https://stats.cc/siege/Username/uuid?playlist=ranked`",
        inline: false
      },
      {
        name: "Supported Roles",
        value: "Copper • Bronze • Silver • Gold • Platinum • Emerald • Diamond • Champion",
        inline: false
      }
    )
    .setFooter({
      text: "SiegeVerify • Automatic Rank Verification"
    })
    .setTimestamp();
}

async function sendVerificationReminder() {
  const channelId = process.env.VERIFY_CHANNEL_ID;

  if (!channelId) {
    console.log("VERIFY_CHANNEL_ID is not set.");
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      console.log("Verify channel not found or is not text based.");
      return;
    }

    await channel.send({
      embeds: [buildVerificationReminderEmbed()]
    });

    console.log("Verification reminder sent.");
  } catch (error) {
    console.error("Failed to send verification reminder:", error);
  }
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);

  sendVerificationReminder();

  setInterval(() => {
    sendVerificationReminder();
  }, 60 * 60 * 1000);
});

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "verify") return;

    await interaction.deferReply();

    const profileUrl = interaction.options.getString("profileurl");

    if (!isValidStatsCCUrl(profileUrl)) {
      await interaction.editReply(
        "❌ Please provide a valid Stats.cc Siege profile URL.\n\nExample:\nhttps://stats.cc/siege/Username/uuid?playlist=ranked"
      );
      return;
    }

    const playerName = extractPlayerName(profileUrl);
    const stats = await getStatsFromStatsCC(profileUrl);

    await assignRankRole(interaction.member, stats.maxRank);

    const embed = new EmbedBuilder()
      .setColor(rankColors[stats.maxRank] || 0xff2f8f)
      .setAuthor({
        name: "SiegeVerify",
        iconURL: rankIcons[stats.maxRank] || rankIcons.Unranked
      })
      .setTitle(`🎮 ${playerName}`)
      .setURL(profileUrl)
      .setThumbnail(rankIcons[stats.maxRank] || rankIcons.Unranked)
      .setDescription(
        "**Rainbow Six Siege Rank Verification**\n\nSuccessfully verified via Stats.cc"
      )
      .addFields(
        {
          name: "⭐ Max Rank",
          value: `**${stats.maxRank}**`,
          inline: true
        },
        {
          name: "🎯 K/D",
          value: `**${stats.kd}**`,
          inline: true
        },
        {
          name: "👤 Verified User",
          value: `${interaction.user}`,
          inline: false
        },
        {
          name: "📋 Status",
          value: "✅ Rank role assigned",
          inline: false
        }
      )
      .setFooter({
        text: "SiegeVerify • Automatic Rank Verification"
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Interaction error:", error);

    let message = error.message;

    if (error.response && error.response.status === 403) {
      message = "Stats.cc blocked the request from the hosting server. Try again later or use manual verification.";
    }

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        `❌ Verification failed.\n\nReason: **${message}**`
      ).catch(console.error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
