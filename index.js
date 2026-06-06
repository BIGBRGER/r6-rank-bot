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

// Replace these later with proper hosted image URLs if you want custom icons
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

async function getRankFromStatsCC(profileUrl) {
  const response = await axios.get(profileUrl, {
    timeout: 8000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(response.data);
  const pageText = $("body").text().replace(/\s+/g, " ").trim();

  const maxRanksMatch = pageText.match(/Max Ranks(.{0,500})/i);

  if (!maxRanksMatch) {
    return "Unranked";
  }

  const maxRanksText = maxRanksMatch[1];

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
    if (maxRanksText.toLowerCase().includes(rank.toLowerCase())) {
      return rank;
    }
  }

  return "Unranked";
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

function getEmbedColor(rank) {
  const colors = {
    Copper: 0x9c6b30,
    Bronze: 0xcd7f32,
    Silver: 0xc0c0c0,
    Gold: 0xffd700,
    Platinum: 0x00bcd4,
    Emerald: 0x2ecc71,
    Diamond: 0x9b59b6,
    Champion: 0xff1493,
    Unranked: 0x808080
  };

  return colors[rank] || 0x2b2d31;
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
    const rank = await getRankFromStatsCC(profileUrl);

    await assignRankRole(interaction.member, rank);

    const embed = new EmbedBuilder()
      .setColor(getEmbedColor(rank))
      .setAuthor({
        name: "SiegeVerify",
        iconURL: rankIcons[rank]
      })
      .setTitle(playerName)
      .setURL(profileUrl)
      .setDescription(`Player information for **${playerName}**`)
      .setThumbnail(rankIcons[rank])
      .addFields(
        { name: "Rank Type", value: "Peak / Max Rank", inline: true },
        { name: "Rank", value: `**${rank}**`, inline: true },
        { name: "Verified User", value: `${interaction.user}`, inline: false },
        { name: "Status", value: "✅ Rank role assigned", inline: false }
      )
      .setFooter({ text: "SiegeVerify • Powered by Stats.cc" })
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
