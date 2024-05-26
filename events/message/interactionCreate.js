const Discord = require("discord.js");
const db = require("quick.db");
const Event = require("../../structures/Events");
const { modalAskQuestions } = require("../../utils/askQuestions.js");
const claimCommand = require("../../commands/tickets/claim");
const closeCommand = require("../../commands/tickets/close");

let cooldownList = [];

module.exports = class InteractionCreate extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(interaction) {
    const message = interaction.message;
    const user = interaction.user;
    const config = this.client.config;
    const language = this.client.language;
    
    if(user.bot) return;
    if (interaction.isCommand()) {
      const cmd = this.client.slashCommands.get(interaction.commandName);
      if (!cmd) return interaction.reply({ content: "> Error occured, please contact Bot Owner.", ephemeral: true });

      interaction.member = interaction.guild.members.cache.get(interaction.user.id);
      
      if(!this.client.utils.hasPermissions(interaction, interaction.member, cmd.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], ephemeral: true });

      const args = [];
      for (let option of interaction.options.data) {
        if (option.type === "SUB_COMMAND") {
          if (option.name) args.push(option.name);
          option.options?.forEach((x) => {
            if (x.value) args.push(x.value);
          });
        } else if (option.value) args.push(option.value);
      }

      if(this.client.cmdConfig[cmd.name]) {
        let cmdConfig = this.client.cmdConfig[cmd.name];
        if(cmdConfig.enabled == false) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cmd_disabled, this.client.embeds.error_color)] });
        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], ephemeral: true });
        }
        let findCooldown = cooldownList.find((c) => c.name == cmd.name && c.id == interaction.user.id);
        if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.cooldown, true)) {
          if(findCooldown) {
            let time = this.client.utils.formatTime(findCooldown.expiring - Date.now());
            return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cooldown.replace("<cooldown>", time), this.client.embeds.error_color)], ephemeral: true });
          } else if(!findCooldown && this.client.cmdConfig[cmd.name].cooldown > 0) {
            let cooldown = {
              id: interaction.user.id,
              name: cmd.name,
              expiring: Date.now() + (this.client.cmdConfig[cmd.name].cooldown * 1000),
            };
    
            cooldownList.push(cooldown);
    
            setTimeout(() => {
              cooldownList.splice(cooldownList.indexOf(cooldown), 1);
            }, this.client.cmdConfig[cmd.name].cooldown * 1000);
          }
        }
      }

      cmd.slashRun(interaction, args);
    }
    if (interaction.isButton()) {
      if(interaction.customId.startsWith("createTicket")) {
        await interaction.deferUpdate();
        let blackListed = false;
        let member = interaction.guild.members.cache.get(user.id);
        for(let i = 0; i < config.roles.blacklist.length; i++) {
          if(member.roles.cache.has(config.roles.blacklist[i])) blackListed = true;
        }
        if(blackListed == true) 
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], ephemeral: true })
        if(config.users.blacklist.includes(user.id))
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], ephemeral: true })
        const noCategory = new Discord.MessageEmbed()
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.language.ticket.no_category)
          .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp()
          .setColor(this.client.embeds.error_color);
  
        if(config.channels.category_id == "") 
          return interaction.followUp({ embeds: [noCategory], ephemeral: true });
  
        this.client.emit("ticketCreate", interaction, member, "No Reason", {
          status: interaction.customId.includes("_"),
          cat_id: interaction.customId.includes("_") ? `${interaction.customId.replace("createTicket_", "")}` : 'n/a'
        });
      }
  
      if(interaction.customId == "closeTicket" && interaction.user.bot == false) {
        let close = new closeCommand(this.client);
        await close.slashRun(interaction);
      }

      if(interaction.customId == "claimTicket" && interaction.user.bot == false) {
        let claim = new claimCommand(this.client);
        await claim.slashRun(interaction);
      }

      if(interaction.customId == "accept_quote") {
        let commission = db.fetch(`commission_${interaction.channel.id}`);
        if(commission && commission?.status == "NO_STATUS") {
          if(commission.quoteList.find((x) => x.user == interaction.user.id)) return interaction.deferUpdate();
          let commissionMessage = commission.quoteList.find((m) => m.messageId == interaction.message.id);
          if(!commissionMessage) return;

          let bulkArr = commission.quoteList.map((x) => x.messageId);

          let quoteEmbed = new Discord.MessageEmbed()
            .setColor(this.client.embeds.service.quoteAccepted.color);
        
          if(this.client.embeds.service.quoteAccepted.title) quoteEmbed.setTitle(this.client.embeds.service.quoteAccepted.title);
          
          if(this.client.embeds.service.quoteAccepted.description) quoteEmbed.setDescription(this.client.embeds.service.quoteAccepted.description.replace("<price>", commissionMessage.price)
            .replace("<user>", `<@!${commissionMessage.user}>`)
            .replace("<currency>", this.client.config.general.currency)
            .replace("<currencySymbol>", this.client.config.general.currency_symbol)
            .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
            .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes));
          
          let field = this.client.embeds.service.quoteAccepted.fields;
          for(let i = 0; i < this.client.embeds.service.quoteAccepted.fields.length; i++) {
            quoteEmbed.addField(field[i].title.replace("<currency>", this.client.config.general.currency), field[i].description.replace("<price>", commissionMessage.price)
              .replace("<user>", `<@!${commissionMessage.user}>`)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
              .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes), true)
          }
          
          if(this.client.embeds.service.quoteAccepted.footer == true ) quoteEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
          if(this.client.embeds.service.quoteAccepted.thumbnail == true) quoteEmbed.setThumbnail(user.displayAvatarURL());
          
          interaction.reply({ embeds: [quoteEmbed] });
          
          commission.status = "QUOTE_ACCEPTED"
          commission.quoteList = [commissionMessage];
          
          let commissionsChannel = this.client.utils.findChannel(interaction.guild, config.channels.commissions);
          if(commissionsChannel) {
            let commFetchedMsg = await commissionsChannel.messages.fetch(commission.commMessageId);
            await commFetchedMsg.delete();
          }
          
          interaction.channel.bulkDelete(bulkArr).catch((err) => {});
          db.set(`commission_${interaction.channel.id}`, commission);
        }
      }

      if(interaction.customId.startsWith("commission_") && interaction.guild) {
        const commChannel = this.client.channels.cache.get(interaction.customId.split("_")[1]);
        if(!commChannel) return this.client.utils.sendError("Commissions error isn't set in config.yml");

        let commPrice = new Discord.MessageActionRow()
          .addComponents(
            new Discord.TextInputComponent()
            .setCustomId("commission_price")
            .setLabel(language.modals.labels.comm_price)
            .setPlaceholder(language.modals.placeholders.comm_price)
            .setMinLength(1)
            .setRequired(true)
            .setStyle("SHORT")
          );
        
        let commTime = new Discord.MessageActionRow()
          .addComponents(
            new Discord.TextInputComponent()
            .setCustomId("commission_time")
            .setLabel(language.modals.labels.comm_time)
            .setPlaceholder(language.modals.placeholders.comm_time)
            .setMinLength(1)
            .setRequired(true)
            .setStyle("SHORT")
          );
        
        let commNote = new Discord.MessageActionRow()
          .addComponents(
            new Discord.TextInputComponent()
            .setCustomId("commission_note")
            .setLabel(language.modals.labels.comm_note)
            .setPlaceholder(language.modals.placeholders.comm_note)
            .setStyle("PARAGRAPH")
          );

        let commissionModal = new Discord.Modal()
          .setTitle(language.titles.review)
          .setCustomId("commission_modal")
          .addComponents([commPrice, commTime, commNote]);

        interaction.showModal(commissionModal);

        const filter = (i) => i.customId == 'commission_modal';
        interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
          const price = md.fields.getTextInputValue("commission_price");
          const timeFrame = md.fields.getTextInputValue("commission_time");
          const notes = md.fields.getTextInputValue("commission_note");

          let commission = db.fetch(`commission_${commChannel.id}`);
          if(!commission || commission?.status != "NO_STATUS") return md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.quote.ephemeral });

          let embed = new Discord.MessageEmbed()
            .setColor(this.client.embeds.service.quote.color);
          if(this.client.embeds.service.quote.title) embed.setTitle(this.client.embeds.service.quote.title);

          let history = db.fetch(`reviews_${interaction.guild.id}_${interaction.user.id}`) || [];
          let bio = db.fetch(`bio_${interaction.guild.id}_${interaction.user.id}`) || "N/A";
          let availableHours = db.fetch(`availableHours_${interaction.user.id}`) || "N/A";

          let totalRating = 0;
          for(let i = 0; i < history.length; i++) {
            totalRating += parseInt(history[i].rating);
          }

          totalRating = Math.floor(totalRating/history.length);

          if(this.client.embeds.service.quote.description) embed.setDescription(this.client.embeds.service.quote.description.replace("<price>", price)
            .replace("<user>", interaction.user)
            .replace("<bio>", bio)
            .replace("<availableHours>", availableHours)
            .replace("<currency>", this.client.config.general.currency)
            .replace("<currencySymbol>", this.client.config.general.currency_symbol)
            .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
            .replace("<notes>", notes || this.client.language.service.commission.no_notes)
            .replace("<rating>", "⭐".repeat(totalRating)));

          let field = this.client.embeds.service.quote.fields;
          for(let i = 0; i < this.client.embeds.service.quote.fields.length; i++) {
            embed.addField(field[i].title.replace("<currency>", this.client.config.general.currency), field[i].description.replace("<price>", price)
              .replace("<user>", interaction.user)
              .replace("<bio>", bio)
              .replace("<availableHours>", availableHours)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
              .replace("<notes>", notes || this.client.language.service.commission.no_notes)
              .replace("<rating>", "⭐".repeat(totalRating)), true)
          }

          if(this.client.embeds.service.quote.footer == true ) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
          if(this.client.embeds.service.quote.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
            
          let bttnRow = new Discord.MessageActionRow().addComponents(
            new Discord.MessageButton()
              .setLabel(this.client.language.buttons.quote)
              .setStyle("SUCCESS")
              .setEmoji(this.client.config.emojis.quote)
              .setCustomId("accept_quote")
          );

          commChannel.send({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow] }).then(async(msg) => {
            commission.quoteList.push({
              user: interaction.user.id,
              messageId: msg.id,
              price,
              timeFrame,
              notes,
            });

            db.set(`commission_${commChannel.id}`, commission);
          });

          md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.quote_sent, this.client.embeds.success_color)], ephemeral: true });
        });
      }

      if(interaction.customId.startsWith("withdraw_") && interaction.guild) {
        let request = db.fetch(`withdrawRequest_${interaction.message.id}`);
        if(request) {
          if(request.user == interaction.user.id) return interaction.deferUpdate();
          let wType = interaction.customId.split("_")[1];
          if(wType == "yes") {
            const balance = db.fetch(`balance_${request.user}`) || 1;
            const reqUser = this.client.users.cache.get(request.user);
            let mail = db.fetch(`paypal_${request.user}`) || "";
            if(request.amount > balance) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.invalid_withdraw, this.client.embeds.error_color)], ephemeral: true });
            if(!mail) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.withdraw.ephemeral });

            db.subtract(`balance_${request.user}`, request.amount);

            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_accepted.replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)], ephemeral: true });
            await reqUser.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_accepted_dm.replace("<acceptedBy>", interaction.user).replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)] }).catch((err) => {
              console.error("User's DM Closed");
            });

            interaction.message.delete();

            let withdrawAccepted = new Discord.MessageEmbed()
              .setColor(this.client.embeds.service.withdrawAccepted.color);

            if(this.client.embeds.service.withdrawAccepted.title) withdrawAccepted.setTitle(this.client.embeds.service.withdrawAccepted.title);
            let field = this.client.embeds.service.withdrawAccepted.fields;
            for(let i = 0; i < this.client.embeds.service.withdrawAccepted.fields.length; i++) {
            withdrawAccepted.addField(field[i].title.replace("<currency>", this.client.config.general.currency), field[i].description.replace("<user>", interaction.user)
              .replace("<freelancer>", `<@!${request.user}>`)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", balance))
            }

            if(this.client.embeds.service.withdrawAccepted.footer == true) withdrawAccepted.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
            if(this.client.embeds.service.withdrawAccepted.thumbnail == true) withdrawAccepted.setThumbnail(interaction.guild.iconURL());

            if(this.client.embeds.service.withdrawAccepted.description) withdrawAccepted.setDescription(this.client.embeds.service.withdrawAccepted.description.replace("<user>", interaction.user)
              .replace("<freelancer>", `<@!${request.user}>`)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", balance));

            let withdrawRow = new Discord.MessageActionRow()
              .addComponents(
                new Discord.MessageButton()
                  .setURL(`https://www.paypal.com/cgi-bin/webscr?&cmd=_xclick&business=${mail}&currency_code=${this.client.config.general.currency}&amount=${request.amount}&item_name=${encodeURIComponent(this.client.language.service.withdraw_reason.replace("<user>", interaction.user.username).trim())}&no_shipping=1`)
                  .setLabel(this.client.language.buttons.send_withdraw)
                  .setStyle("LINK")
              );

            interaction.channel.send({ embeds: [withdrawAccepted], components: [withdrawRow] });

            db.delete(`withdrawRequest_${interaction.message.id}`);
          } else {
            const reqUser = this.client.users.cache.get(request.user);
            
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_denied.replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)], ephemeral: true });
            await reqUser.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_denied_dm.replace("<acceptedBy>", interaction.user).replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)] }).catch((err) => {
              console.error("User's DM Closed");
            });

            interaction.message.delete();

            let withdrawDenied = new Discord.MessageEmbed()
              .setColor(this.client.embeds.service.withdrawDenied.color);

            if(this.client.embeds.service.withdrawDenied.title) withdrawDenied.setTitle(this.client.embeds.service.withdrawDenied.title);
            let field = this.client.embeds.service.withdrawDenied.fields;
            for(let i = 0; i < this.client.embeds.service.withdrawDenied.fields.length; i++) {
              withdrawDenied.addField(field[i].title.replace("<currency>", this.client.config.general.currency), field[i].description.replace("<user>", interaction.user)
                .replace("<freelancer>", `<@!${request.user}>`)
                .replace("<amount>", request.amount)
                .replace("<currency>", this.client.config.general.currency)
                .replace("<currencySymbol>", this.client.config.general.currency_symbol)
                .replace("<mail>", mail)
                .replace("<balance>", balance))
            }

            if(this.client.embeds.service.withdrawDenied.footer == true) withdrawDenied.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
            if(this.client.embeds.service.withdrawDenied.thumbnail == true) withdrawDenied.setThumbnail(interaction.guild.iconURL());

            if(this.client.embeds.service.withdrawDenied.description) withdrawDenied.setDescription(this.client.embeds.service.withdrawDenied.description.replace("<user>", interaction.user)
              .replace("<freelancer>", `<@!${request.user}>`)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", balance));

            interaction.channel.send({ embeds: [withdrawDenied] });

            db.delete(`withdrawRequest_${interaction.message.id}`);
          }
        }
      }

      if(interaction.customId == "ask_noCategory") {
        await modalAskQuestions(this.client, interaction, interaction.channel, this.client.config.category.questionsList)
      } else if(interaction.customId.startsWith("ask_") && interaction.customId.split("_")[1] != "noCategory") {
        let catSelected = this.client.config.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        
        await modalAskQuestions(this.client, interaction, interaction.channel, catSelected.questionsList, catSelected);
      }
  
      // Suggestion Vote
      if(interaction.customId.startsWith("vote_") && interaction.guild) {
        let suggestionData = db.fetch(`suggestion_${interaction.guild.id}_${interaction.message.id}`);
        if(suggestionData) {
          let voteType = interaction.customId.split("_")[1].toLowerCase();
  
          if (voteType == "yes") {
            if (suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.already_voted, this.client.embeds.error_color)], ephemeral: true });
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: parseInt(suggestionData.yes) + 1,
              no: parseInt(suggestionData.no),
              voters: suggestionData.voters.concat({ user: interaction.user.id, type: "yes" }),
              status: 'none',
            };
            db.set(`suggestion_${interaction.guild.id}_${interaction.message.id}`, newData);
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_yes, this.client.embeds.success_color)], ephemeral: true });
            await this.client.utils.updateSuggestionEmbed(this.client, interaction);
          } else if (voteType == "no") {
            if (suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.already_voted, this.client.embeds.error_color)], ephemeral: true });
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: parseInt(suggestionData.yes),
              no: parseInt(suggestionData.no) + 1,
              voters: suggestionData.voters.concat({ user: interaction.user.id, type: "no" }),
              status: 'none',
            };
            db.set(`suggestion_${interaction.guild.id}_${interaction.message.id}`, newData);
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_no, this.client.embeds.success_color)], ephemeral: true });
            await this.client.utils.updateSuggestionEmbed(this.client, interaction);
          } else if (voteType == "reset") {
            if (!suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.not_voted, this.client.embeds.error_color)], ephemeral: true });
            let removeYes = suggestionData.voters.find((d) => d.type == "yes" && d.user == interaction.user.id);
            let removeNo = suggestionData.voters.find((d) => d.type == "no" && d.user == interaction.user.id);
  
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: removeYes ? parseInt(suggestionData.yes) - 1 : parseInt(suggestionData.yes),
              no: removeNo ? parseInt(suggestionData.no) - 1 : parseInt(suggestionData.no),
              voters: suggestionData.voters.filter((v) => v.user != interaction.user.id),
              status: 'none',
            };
            db.set(`suggestion_${interaction.guild.id}_${interaction.message.id}`, newData);
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_reset, this.client.embeds.success_color)], ephemeral: true });
            await this.client.utils.updateSuggestionEmbed(this.client, interaction);
          }
        }
      }
    }

    // Suggestion Decision
    if(interaction.isSelectMenu()) {
      if(interaction.channel.type != "DM") {
        let decisionData = db.fetch(`suggestionDecision_${interaction.guild.id}_${interaction.message.id}`);
        if(interaction.customId == "decision_menu" && decisionData && this.client.config.general.sugg_decision == true) {
          let suggChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.suggestions);
          let fetchSuggestion = await suggChannel.messages.fetch(decisionData);
          if(!fetchSuggestion) return;
          let decidedChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.sugg_logs);
          let value = interaction.values[0];
  
          if(value == "decision_accept") {
            let acceptEmbed = new Discord.MessageEmbed()
              .setTitle(this.client.language.titles.sugg_accepted)
              .setColor(this.client.embeds.success_color);
            
            if(fetchSuggestion.embeds[0].description) acceptEmbed.setDescription(fetchSuggestion.embeds[0].description);
            if(fetchSuggestion.embeds[0].footer) acceptEmbed.setFooter(fetchSuggestion.embeds[0].footer).setTimestamp();
            if(fetchSuggestion.embeds[0].thumbnail) acceptEmbed.setThumbnail(fetchSuggestion.embeds[0].thumbnail.url);
            if(fetchSuggestion.embeds[0].fields[0]) acceptEmbed.addFields(fetchSuggestion.embeds[0].fields);
  
            await interaction.message.delete();
            await fetchSuggestion.delete();
            decidedChannel.send({ embeds: [acceptEmbed] });
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.accepted, this.client.embeds.success_color)], ephemeral: true });
          } else if(value == "decision_deny") {
            let denyEmbed = new Discord.MessageEmbed()
              .setTitle(this.client.language.titles.sugg_denied)
              .setColor(this.client.embeds.error_color);
  
            if(fetchSuggestion.embeds[0].description) denyEmbed.setDescription(fetchSuggestion.embeds[0].description);
            if(fetchSuggestion.embeds[0].footer) denyEmbed.setFooter(fetchSuggestion.embeds[0].footer).setTimestamp();
            if(fetchSuggestion.embeds[0].thumbnail) denyEmbed.setThumbnail(fetchSuggestion.embeds[0].thumbnail.url);
            if(fetchSuggestion.embeds[0].fields[0]) denyEmbed.addFields(fetchSuggestion.embeds[0].fields);
  
            await interaction.message.delete();
            await fetchSuggestion.delete();
            decidedChannel.send({ embeds: [denyEmbed] });
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.denied, this.client.embeds.success_color)], ephemeral: true });
          } else if(value == "decision_delete") {
            await interaction.message.delete();
            await fetchSuggestion.delete();
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.deleted, this.client.embeds.success_color)], ephemeral: true });
            db.delete(`suggestion_${interaction.guild.id}_${decisionData}`);
          }
        }
      }
    } 
	}
};
