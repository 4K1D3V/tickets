const Command = require("../../structures/Command");
const db = require("quick.db");

module.exports = class Balance extends Command {
  constructor(client) {
    super(client, {
      name: "balance",
      description: client.cmdConfig.balance.description,
      usage: client.cmdConfig.balance.usage,
      permissions: client.cmdConfig.balance.permissions,
      aliases: client.cmdConfig.balance.aliases,
      category: "service",
      listed: client.cmdConfig.balance.enabled,
      slash: true,
      options: [{
        name: "user",
        description: "User whoes balance to see",
        type: "USER",
        required: false
      }]
    });
  }

  async run(message, args) {
    let user = message.mentions.users.first() || message.author;
    let balance = db.fetch(`balance_${user.id}`) || 0;

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.balance.replace("<user>", user).replace("<balance>", balance), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let user = interaction.options.getUser("user") || interaction.user;
    let balance = db.fetch(`balance_${user.id}`) || 0;

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.balance.replace("<user>", user).replace("<balance>", balance), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.balance.ephemeral });
  }
};