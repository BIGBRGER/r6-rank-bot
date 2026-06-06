const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify your Rainbow Six Siege rank from a Stats.cc profile")
    .addStringOption(option =>
      option
        .setName("profileurl")
        .setDescription("Your Stats.cc Siege ranked profile URL")
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  console.log("Deploying slash commands...");

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands deployed.");
}

main().catch(console.error);