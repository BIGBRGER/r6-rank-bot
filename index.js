const { Client, GatewayIntentBits } = require("discord.js");
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

function isValidStatsCCUrl(url) {
  return url.startsWith("https://stats.cc/siege/");
}

async function getRankFromStatsCC(profileUrl) {
  const response = await axios.get(profileUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(response.data);
  const pageText = $("body").text().replace(/\s+/g, " ");

  const rankMatch = pageText.match(
    /Peak Rank\s+(Champion|Diamond|Emerald|Platinum|Gold|Silver|Bronze|Copper)\s+[IVX]+/i
  );

  if (rankMatch) {
    const rank = rankMatch[1].toLowerCase();
    return rank.charAt(0).toUpperCase() + rank.slice(1);
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
    throw new Error(`No role ID set for ${rank}`);
  }

  await member.roles.add(roleId);

  if (rankRoles.RankVerified) {
    await member.roles.add(rankRoles.RankVerified);
  }
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "verify") {
    await interaction.deferReply();

    const profileUrl = interaction.options.getString("profileurl");

    if (!isValidStatsCCUrl(profileUrl)) {
      await interaction.editReply(
        "❌ Please use a valid Stats.cc Siege profile URL.\n\nExample:\nhttps://stats.cc/siege/Username/uuid?playlist=ranked"
      );
      return;
    }

    try {
      const rank = await getRankFromStatsCC(profileUrl);
      await assignRankRole(interaction.member, rank);

      await interaction.editReply(
        `🎮 **Rank Verification Complete!**\n\n👤 Player: ${interaction.user}\n🏆 Peak Rank: **${rank}**\n✅ Rank role assigned`
      );
    } catch (error) {
      console.error(error);

      await interaction.editReply(
        "❌ I could not verify your peak rank from Stats.cc. Check the profile URL and make sure the page is public."
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
