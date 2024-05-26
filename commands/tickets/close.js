const Command = require("../../structures/Command");
const db = require("quick.db");
const { textTranscript, htmlTranscript } = require("../../utils/createTranscript.js");
const askReview = require("../../utils/askReview.js");

module.exports = class Close extends Command {
	constructor(client) {
		super(client, {
			name: "close",
			description: client.cmdConfig.close.description,
			usage: client.cmdConfig.close.usage,
			permissions: client.cmdConfig.close.permissions,
			aliases: client.cmdConfig.close.aliases,
			category: "tickets",
			listed: client.cmdConfig.close.enabled,
			slash: true,
			options: [{
				name: "reason",
				description: "Reason for closing ticket",
				type: "STRING",
				required: false
			}]
		});
	}
  
  async run(message, args) {
    const config = this.client.config;
		const language = this.client.language;

    if (!this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

		let ticketID = db.fetch(`ticketCount_${message.guild.id}`);
		let reason = args[0] ? args.join(' ') : "";

		if(config.general.confirm_close == false) {
			message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.member.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });
			await askReview(this.client, message.channel, message.guild);

			let ticketData = db.fetch(`ticketData_${message.channel.id}`);
			let memberTickets = db.fetch(`tickets_${ticketData?.owner}`) || [];
			memberTickets = memberTickets.filter((x) => x.channel != message.channel.id);

			let canRename = await this.client.utils.canEditName(message.guild, message.channel);
			if(this.client.config.general.rename_close == true && canRename == true && !message.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
				let ticketOwner = this.client.users.cache.get(ticketData.owner);
				message.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketID)).catch((e) => this.client.utils.sendError("Bot cannot rename this channel at the moment."));
			}

			db.set(`tickets_${ticketData?.owner}`, memberTickets);
			db.delete(`choosingCategory_${ticketData?.owner}`);

			if(config.general.transcripts == true) {
				if(config.general.transcript_type == "HTML") {
					await htmlTranscript(this.client, message.channel, message.member, `ticket-${ticketID}`, reason);
				} else {
					await textTranscript(this.client, message.channel, message.member, ticketID, reason);
				}
			} else {
				let dataRemove = db
					.all()
					.filter((i) => i.ID.includes(message.channel.id));
				dataRemove.forEach((x) => db.delete(x.ID));

				setTimeout(async() => {
					message.channel.delete();
				}, this.client.config.general.delete_after * 1000);
			}
			return;
		}
  
    this.client.emit("ticketClose", message, message.member, reason);
  }
	async slashRun(interaction, args) {
		const config = this.client.config;
		const language = this.client.language;

    if (!this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

		let ticketID = db.fetch(`ticketCount_${interaction.guild.id}`);
		let reason = interaction.options?.getString("reason") || "No Reason";

		if(config.general.confirm_close == false) {
			interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });
			await askReview(this.client, interaction.channel, interaction.guild);
			
			let ticketData = db.fetch(`ticketData_${interaction.channel.id}`);
			let memberTickets = db.fetch(`tickets_${ticketData?.owner}`) || [];
			memberTickets = memberTickets.filter((x) => x.channel != interaction.channel.id);

			let canRename = await this.client.utils.canEditName(interaction.guild, interaction.channel);
			if(this.client.config.general.rename_close == true && canRename == true && !interaction.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
				let ticketOwner = this.client.users.cache.get(ticketData.owner);
				interaction.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketID)).catch((e) => this.client.utils.sendError("Bot cannot rename this channel at the moment."));
			}

			db.set(`tickets_${ticketData?.owner}`, memberTickets);
			db.delete(`choosingCategory_${ticketData?.owner}`);

			if(config.general.transcripts == true) {
				if(config.general.transcript_type == "HTML") {
					await htmlTranscript(this.client, interaction.channel, interaction.member, `ticket-${ticketID}`, reason = "No Reason");
				} else {
					await textTranscript(this.client, interaction.channel, interaction.member, ticketID, reason = "No Reason");
				}
			} else {
				//await askReview(this.client, message.channel, interaction.guild);
				let dataRemove = db
					.all()
					.filter((i) => i.ID.includes(interaction.channel.id));

				dataRemove.forEach((x) => db.delete(x.ID));

				setTimeout(async() => {
					interaction.channel.delete();
				}, this.client.config.general.delete_after * 1000);
			}
			return;
		}
    this.client.emit("ticketClose", interaction, interaction.member, reason);
	}
};
