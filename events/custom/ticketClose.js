const db = require("quick.db");
const Event = require("../../structures/Events");
const { MessageButton, MessageActionRow, MessageEmbed } = require("discord.js");
const { textTranscript, htmlTranscript } = require("../../utils/createTranscript.js"); 
const askReview = require("../../utils/askReview.js");

module.exports = class TicketClose extends Event {
  constructor(...args) {
    super(...args);
  }

  async run(message, member, reason = "No Reason") {
    let config = this.client.config;
    let language = this.client.language;
    let confirmBttn = new MessageButton()
      .setStyle('PRIMARY')
      .setLabel(this.client.language.buttons.confirm_close)
      .setEmoji(config.emojis.close)
      .setCustomId('confirmClose');
    let cancelBttn = new MessageButton()
      .setStyle('DANGER')
      .setLabel(this.client.language.buttons.cancel_close)
      .setEmoji(config.emojis.cancel)
      .setCustomId('cancelClose');
  
    let confirmRow = new MessageActionRow()
      .addComponents(confirmBttn)
      .addComponents(cancelBttn);
    let confirm = this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.close_confirmation, this.client.embeds.success_color);
    if (this.client.embeds.close.image.enabled == true) confirm.setImage(this.client.embeds.close.image.url);
    if (this.client.embeds.close.thumbnail.enabled == true) confirm.setThumbnail(this.client.embeds.close.thumbnail.url);
  
    let m;
    if(message.type == "APPLICATION_COMMAND") {
      m = await message.reply({ embeds: [confirm], components: [confirmRow], fetchReply: true });
    } else if(message.type == "MESSAGE_COMPONENT"){
      m = await message.reply({ embeds: [confirm], components: [confirmRow], fetchReply: true });
    } else {
      m = await message.channel.send({ embeds: [confirm], components: [confirmRow] });
    }

    const filter = i => i.user.id === member.id;
    let collector = m.createMessageComponentCollector({filter, componentType: "BUTTON", time: 25000 });
    collector.on('collect', async (b) => {
      await b.deferUpdate();
      if (b.customId == `confirmClose`) {
        await askReview(this.client, message.channel, message.guild);
        collector.stop("claimed");
        let ticketID = db.fetch(`ticketCount_${message.guild.id}`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });
  
        if(this.client.config.general.dm_message) {
          let dmUserEmbed = new MessageEmbed()
            .setTitle(this.client.language.titles.closed_dm)
            .setColor(this.client.embeds.general_color)
            .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTimestamp()
            .setDescription(this.client.language.ticket.closed_dm);
    
          member.send({ embeds: [dmUserEmbed] }).catch((err) => {
            console.error("User's DM Closed");
          });
        }

				let ticketData = db.fetch(`ticketData_${message.channel.id}`);
        const ticketOwner = this.client.users.cache.get(ticketData.owner);
				let memberTickets = db.fetch(`tickets_${ticketData?.owner}`) || [];
				memberTickets = memberTickets.filter((x) => x.channel != message.channel.id);

				db.set(`tickets_${ticketData?.owner}`, memberTickets);
        db.delete(`choosingCategory_${ticketData?.owner}`);
  
        if (config.general.transcripts == false) {
          let dataRemove = db
            .all()
            .filter((i) => i.ID.includes(message.channel.id));
      
          dataRemove.forEach((x) => db.delete(x.ID));
          setTimeout(async() => {
            message.channel.delete();
          }, this.client.config.general.delete_after * 1000);
          return;
        }
        if (config.channels.transcripts == "")
          return message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.no_transcript, this.client.embeds.error_color)] });
        
        if(config.general.transcript_type == "HTML") {
          await htmlTranscript(this.client, message.channel, message.member, `ticket-${ticketID}`, reason);
        } else {
          await textTranscript(this.client, message.channel, message.member, ticketID, reason);
        }
        let canRename = await this.client.utils.canEditName(message.guild, message.channel);
        if(this.client.config.general.rename_close == true && canRename == true && !message.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
          message.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketID)).catch((e) => this.client.utils.sendError("Bot cannot rename this channel at the moment."));
        }
      } else if (b.customId == `cancelClose`) {
        collector.stop("claimed");
        confirmRow.components[0].setStyle("SECONDARY").setDisabled(true);
        confirmRow.components[1].setStyle("SECONDARY").setDisabled(true);
        m.edit({ embeds: [confirm], components: [confirmRow] });
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.cancel_delete, this.client.embeds.success_color)] });
      }
    });
    collector.on("end", (collected, reason) => {
      if(!message.channel) return;
      confirmRow.components[0].setStyle("SECONDARY").setDisabled(true);
      confirmRow.components[1].setStyle("SECONDARY").setDisabled(true);

      
      m.edit({ embeds: [confirm], components: [confirmRow] });
      if(reason.toLowerCase() == "claimed") return;
      
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.time_expired, this.client.embeds.error_color)] });
    });
  }
};
