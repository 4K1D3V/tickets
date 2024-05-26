const Discord = require("discord.js");
const Event = require("../../structures/Events");
const db = require("quick.db");
const { htmlTranscript } = require("../../utils/createTranscript.js");

module.exports = class GuildMemberRemove extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(member) {
	  let config = this.client.config;
    if(this.client.config.general.remove_leave == true) {
      let ticketList = db.fetch(`tickets_${member.id}`) || [];
      if(!ticketList || ticketList.length == 0) return;
      ticketList.forEach(async(x) => {
        const channel = member.guild.channels.cache.get(x.channel);
        const ticketData = db.fetch(`ticketData_${x.channel}`);
				await htmlTranscript(this.client, channel, member, `ticket-${ticketData?.id || Math.floor(Math.random() * 9999)}`, "Member Left");
      })
    }
  }
};