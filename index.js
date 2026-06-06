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
  Copper: "https://static.wikia.nocookie.net/rainbowsix/images/4/4e/Copper_Rank.png",
  Bronze: "https://static.wikia.nocookie.net/rainbowsix/images/2/2f/Bronze_Rank.png",
  Silver: "https://static.wikia.nocookie.net/rainbowsix/images/3/3a/Silver_Rank.png",
  Gold: "https://static.wikia.nocookie.net/rainbowsix/images/3/39/Gold_Rank.png",
  Platinum: "https://static.wikia.nocookie.net/rainbowsix/images/f/fc/Platinum_Rank.png",
  Emerald: "https://static.wikia.nocookie.net/rainbowsix/images/2/27/Emerald_Rank.png",
  Diamond: "https://static.wikia.nocookie.net/rainbowsix/images/d/d6/Diamond_Rank.png",
  Champion: "https://static.wikia.nocookie.net/rainbowsix/images/7/73/Champion_Rank.png",
  Unranked: "https://static.wikia.nocookie.net/rainbowsix/images/5/55/Unranked_Rank.png"
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

function cleanRank(rank) {
  if (!rank) return "Unranked";

  const rankMap = [
    "Champion",
    "Diamond",
    "Emerald",
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
    "Copper"
  ];

  for (const baseRank of rankMap) {
    if (rank.toLowerCase().includes(baseRank.toLowerCase())) {
      return baseRank;
    }
  }

  return "Unranked";
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
    timeout: 8000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(response.data);
  const pageText = $("body").text().replace(/\s+/g, " ").trim();

  let currentRank = "Unranked";
  let kd = "N/A";
  let maxRank = "Unranked";

  const currentSeasonMatch = pageText.match(
    /Current Season(.{0,250})/i
  );

  if (currentSeasonMatch) {
    const currentSeasonText = currentSeasonMatch[1];

    currentRank = findHighestRank(currentSeasonText);

    const kdMatch = currentSeasonText.match(/KD\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (kdMatch) {
      kd = kdMatch[1];
    }
  }

  const maxRanksMatch = pageText.match(
    /Max Ranks(.{0,700})/i
  );

  if (maxRanksMatch) {
    const maxRanksText = maxRanksMatch[1];
    maxRank = findHighestRank(maxRanksText);
  }

  if (currentRank === "Unranked") {
    currentRank = findHighestRank(pageText);
  }

  if (kd === "N/A") {
    const kdMatch = pageText.match(/KD\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (kdMatch) {
      kd = kdMatch[1];
    }
  }

  if (maxRank === "Unranked") {
    maxRank = currentRank;
  }

  return {
    currentRank: cleanRank(currentRank),
    kd,
    maxRank: cleanRank(maxRank)
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

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
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
      .setTitle(playerName)
      .setURL(profileUrl)
      .setDescription(`Player information for **${playerName}**`)
      .setThumbnail(rankIcons[stats.maxRank] || rankIcons.Unranked)
      .addFields(
        {
          name: "🏆 Current Rank",
          value: `**${stats.currentRank}**`,
          inline: true
        },
        {
          name: "🎯 K/D",
          value: `**${stats.kd}**`,
          inline: true
        },
        {
          name: "⭐ Max Rank",
          value: `**${stats.maxRank}**`,
          inline: true
        },
        {
          name: "👤 Verified User",
          value: `${interaction.user}`,
          inline: true
        },
        {
          name: "📋 Status",
          value: "✅ Rank role assigned",
          inline: true
        }
      )
      .setFooter({
        text: "SiegeVerify • Stats powered by Stats.cc"
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        `❌ Verification failed.\n\nReason: **${error.message}**`
      ).catch(console.error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
