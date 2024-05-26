const Command = require("../../structures/Command");
const db = require("quick.db");

module.exports = class Mark extends Command {
  constructor(client) {
    super(client, {
      name: "mark",
      description: client.cmdConfig.mark.description,
      usage: client.cmdConfig.mark.usage,
      permissions: client.cmdConfig.mark.permissions,
      aliases: client.cmdConfig.mark.aliases,
      category: "service",
      listed: client.cmdConfig.mark.enabled,
      slash: true,
      options: [{
        name: "type",
        description: "Change commission status",
        type: "STRING",
        required: true,
        choices: [
          {
            name: "Completed",
            value: "completed"
          }
        ]
      }]
    });
  }

  async run(message, args) {
    let type = args[0];
    let options = ["completed"];
    if(!type || !options.includes(type?.toLowerCase())) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.mark.usage)] });
    let commission = db.fetch(`commission_${message.channel.id}`);
    if(!commission) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });

    if(type?.toLowerCase() == "completed") {
      if(commission.status != "QUOTE_ACCEPTED") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.no_quote, this.client.embeds.error_color)] });

      commission.status = "COMPLETED";
      db.set(`commission_${message.channel.id}`, commission);

      let countTax = (parseInt(commission.quoteList[0].price) * parseInt(this.client.config.general.commission_tax)) / 100;

      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.marked.replace("<user>", message.author).replace("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", commission.quoteList[0].price).replace("<taxAmount>", countTax).replace("<type>", "COMPLETED"), this.client.embeds.success_color)] });

      if(this.client.config.general.add_balance == true) {
        db.add(`balance_${commission.quoteList[0].user}`, countTax);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.complete.replace("<freelancer>", `<@!${commission.quoteList[0].user}>`).replace("<percentage>", this.client.config.general.commission_tax).replace("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", commission.quoteList[0].price).replace("<taxAmount>", countTax), this.client.embeds.success_color)] });
      }
    }
  }
  async slashRun(interaction, args) {
    let type = interaction.options.getString("type");

    let options = ["completed"];
    if(!options.includes(type?.toLowerCase())) return interaction.reply({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.mark.usage)] });
    let commission = db.fetch(`commission_${interaction.channel.id}`);
    if(!commission) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });

    if(type == "completed") {
      if(commission.status != "QUOTE_ACCEPTED") return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.no_quote, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });

      commission.status = "COMPLETED";
      db.set(`commission_${interaction.channel.id}`, commission);

      let countTax = (parseInt(commission.quoteList[0].price) * parseInt(this.client.config.general.commission_tax)) / 100;
      
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.marked.replace("<user>", interaction.user).replace("<type>", "COMPLETED"), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });

      if(this.client.config.general.add_balance == true) {
        db.add(`balance_${commission.quoteList[0].user}`, countTax);
        interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.complete.replace("<freelancer>", `<@!${commission.quoteList[0].user}>`).replace("<percentage>", this.client.config.general.commission_tax).replace("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", commission.quoteList[0].price).replace("<taxAmount>", countTax), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });
      }
    }
  }
};