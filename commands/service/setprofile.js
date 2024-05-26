const Command = require("../../structures/Command");
const Discord = require("discord.js");
const db = require("quick.db");

module.exports = class SetProfile extends Command {
  constructor(client) {
    super(client, {
      name: "setprofile",
      description: client.cmdConfig.setprofile.description,
      usage: client.cmdConfig.setprofile.usage,
      permissions: client.cmdConfig.setprofile.permissions,
      aliases: client.cmdConfig.setprofile.aliases,
      category: "service",
      listed: client.cmdConfig.setprofile.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let option = args[0];
    if(!option) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.setprofile.usage)] });
    let value = args.slice(1).join(" ");

    if(option.toLowerCase() == "hours") {
      let hours = db.fetch(`availableHours_${message.author.id}`);
      if(args[1]) {
        db.set(`availableHours_${message.author.id}`, value);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.hours_added.replace("<hours>", value), this.client.embeds.success_color)] });
      } else {
        if(!hours || hours == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        db.delete(`availableHours_${message.author.id}`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.hours_reseted, this.client.embeds.success_color)] });
      }
    } else if(option.toLowerCase() == "paypal") {
      let paypal = db.fetch(`paypal_${message.author.id}`);
      if(args[1]) {
        if(!value.includes("@")) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.invalid_mail, this.client.embeds.error_color )] });
        db.set(`paypal_${message.author.id}`, value);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.paypal_added.replace("<paypal>", value), this.client.embeds.success_color)] });
      } else {
        if(!paypal || paypal == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        db.delete(`paypal_${message.author.id}`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.paypal_reseted, this.client.embeds.success_color)] });
      }
    } else if(option.toLowerCase() == "bio") {
      let bio = db.fetch(`bio_${message.guild.id}_${message.author.id}`);
      if(args[1]) {
        if(value.length >= this.client.config.general.bio_limit) value = value.slice(0, Number(this.client.config.general.bio_limit - 3)) + '...';
        db.set(`bio_${message.guild.id}_${message.author.id}`, value);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.bio_added.replace("<bio>", value), this.client.embeds.success_color)] });
      } else {
        if(!bio || bio == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        db.delete(`bio_${message.guild.id}_${message.author.id}`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.bio_reseted, this.client.embeds.success_color)] });
      }
    } else {
      message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.setprofile.usage)] }); 
    }
  }
  async slashRun(interaction, args) {
    let defaultBio = db.fetch(`bio_${interaction.guild.id}_${interaction.user.id}`) || "";
    let defaultPayPal = db.fetch(`paypal_${interaction.user.id}`) || "";
    let defaultHours = db.fetch(`availableHours_${interaction.user.id}`) || "";
    
    let hoursRow = new Discord.MessageActionRow()
      .addComponents(
        new Discord.TextInputComponent()
          .setLabel(this.client.language.modals.labels.hours)
          .setMaxLength(64)
          .setValue(defaultHours)
          .setStyle("SHORT")
          .setCustomId("profile_hours")
          .setPlaceholder(this.client.language.modals.placeholders.hours));
    let paypalRow = new Discord.MessageActionRow()
      .addComponents(
        new Discord.TextInputComponent()
          .setLabel(this.client.language.modals.labels.paypal)
          .setValue(defaultPayPal)
          .setStyle("SHORT")
          .setMaxLength(64)
          .setCustomId("profile_paypal")
          .setPlaceholder(this.client.language.modals.placeholders.paypal));
    let bioRow = new Discord.MessageActionRow()
      .addComponents(
        new Discord.TextInputComponent()
          .setLabel(this.client.language.modals.labels.bio)
          .setValue(defaultBio)
          .setStyle("PARAGRAPH")
          .setMaxLength(this.client.config.general.bio_limit)
          .setCustomId("profile_bio")
          .setPlaceholder(this.client.language.modals.placeholders.bio));

    let modal = new Discord.Modal().setTitle(this.client.language.titles.setprofile)
      .setCustomId("setprofile_modal")
      .addComponents([paypalRow, hoursRow, bioRow]);
      
    interaction.showModal(modal);
      
    let filter = (int) => int.customId == "setprofile_modal";
    interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async(int) => {
      let hourValue = int.fields.getTextInputValue("profile_hours");
      let paypalValue = int.fields.getTextInputValue("profile_paypal");
      let bioValue = int.fields.getTextInputValue("profile_bio");
      
      if(hourValue.length > 2) {
        db.set(`availableHours_${interaction.user.id}`, hourValue);
      } else {
        db.delete(`availableHours_${interaction.user.id}`)
      }
      
      if(paypalValue.length > 8 && paypalValue.includes("@")) {
        db.set(`paypal_${interaction.user.id}`, paypalValue);
      } else if(paypalValue.length < 8 || !paypalValue.includes("@")) {
        db.delete(`paypal_${interaction.user.id}`);
      }
      
      if(bioValue.length > 8) {
        db.set(`bio_${interaction.guild.id}_${interaction.user.id}`, bioValue);
      } else {
        db.delete(`bio_${interaction.guild.id}_${interaction.user.id}`);
      }
      
      int.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.profile_updated, this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.setprofile.ephemeral });
    }).catch((err) => { });
  }
};
