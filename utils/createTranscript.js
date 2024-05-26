const Discord = require("discord.js");
const db = require("quick.db");
const fs = require("fs");
const { generateTranscript } = require("./utils.js");

const htmlTranscript = async (client, channel, member, ticket, reason) => {
  let config = client.config;
  let ticketData = db.fetch(`ticketData_${channel.id}`);
  let messageCollection = new Discord.Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

  messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }
  
  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  if(data) {
    await generateTranscript(channel, msgs, ticket)
    let path = `./transcripts/${ticket}.html`;
    
    if (config.server.selfhost.enabled == true) {
      let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
      db.set(`transcript_${ticket.replace("ticket-", "")}`, transcriptCode);
    }
    let transcriptAccess = db.fetch(`transcript_${ticket.replace("ticket-", "")}`) || 'N/A';
    
    let logEmbed = new Discord.MessageEmbed()
      .setColor(client.embeds.transcriptLog.color);

    if (client.embeds.transcriptLog.title) logEmbed.setTitle(client.embeds.transcriptLog.title);
    let field = client.embeds.transcriptLog.fields;
    for (let i = 0; i < client.embeds.transcriptLog.fields.length; i++) {
      logEmbed.addField(field[i].title, field[i].description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticket}`.replace("ticket-", ""))
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<channelId>", channel.id)
        .replace("<reason>", reason)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`))
    }

    if (client.embeds.transcriptLog.footer == true) logEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
    if (client.embeds.transcriptLog.thumbnail == true) logEmbed.setThumbnail(member.user.displayAvatarURL());

    if (client.embeds.transcriptLog.description) logEmbed.setDescription(client.embeds.transcriptLog.description.replace("<closedBy>", member.user)
      .replace("<ticketId>", `${ticket}`.replace("ticket-", ""))
      .replace("<author>", `<@${ticketData?.owner}>`)
      .replace("<reason>", reason)
      .replace("<channelId>", channel.id)
      .replace("<channelName>", channel.name)
      .replace("<transcriptCode>", transcriptAccess)
      .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
      .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));
    
    let serverUrl = client.config.server.url;
    let serverPort = client.config.server.port;
    let bttnRow = new Discord.MessageActionRow();
    
    let dwnButton = new Discord.MessageButton()
      .setURL(serverUrl + `:${serverPort}` + `/tickets/${ticket.split("-")[1]}/download`)
      .setLabel(client.language.buttons.transcripts.download)
      .setStyle('LINK')
      .setEmoji(client.config.emojis.transcripts.download);
    let viewButton = new Discord.MessageButton()
      .setURL(serverUrl + `:${serverPort}` + `/tickets/${ticket.split("-")[1]}`)
      .setLabel(client.language.buttons.transcripts.view)
      .setStyle('LINK')
      .setEmoji(client.config.emojis.transcripts.view);
    
    if(client.config.server.selfhost.download == true && client.config.server.enabled == true) bttnRow.addComponents(dwnButton);
    if(client.config.server.selfhost.view == true && client.config.server.enabled == true) bttnRow.addComponents(viewButton);

    let sendObject = {
      embeds: [logEmbed],
      files: client.config.server.selfhost.download == false ? [path] : [],
      components: bttnRow.components.length > 0 ? [bttnRow] : []
    }

    let aChannel = client.utils.findChannel(member.guild, config.channels.transcripts);
    aChannel.send(sendObject).then(() => {
      setTimeout(async() => {
        if(channel) await channel.delete();
      }, client.config.general.delete_after * 1000);
    }); 

    if(config.general.dm_transcript == true) {
      let dmEmbed = new Discord.MessageEmbed()
        .setColor(client.embeds.dmTranscript.color);

      if(client.embeds.dmTranscript.title) dmEmbed.setTitle(client.embeds.dmTranscript.title);
      let field = client.embeds.dmTranscript.fields;
      for(let i = 0; i < client.embeds.dmTranscript.fields.length; i++) {
        dmEmbed.addField(field[i].title, field[i].description.replace("<closedBy>", member.user)
          .replace("<ticketId>", `${ticket}`.replace("ticket-", ""))
          .replace("<author>", `<@${ticketData?.owner}>`)
          .replace("<reason>", reason)
          .replace("<channelId>", channel.id)
          .replace("<channelName>", channel.name)
          .replace("<transcriptCode>", transcriptAccess)
          .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
          .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`))
      }
      
      if(client.embeds.dmTranscript.footer == true) dmEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
      if(client.embeds.dmTranscript.thumbnail == true) dmEmbed.setThumbnail(member.user.displayAvatarURL());

      if(client.embeds.dmTranscript.description) dmEmbed.setDescription(client.embeds.dmTranscript.description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticket}`.replace("ticket-", ""))
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));

      if(config.general.dm_transcript == true) {
        let supportDM = db.fetch(`ticketClaimed_${channel.id}`);
        let authorDM = client.users.cache.get(ticketData?.owner);
        supportDM = client.users.cache.get(supportDM);
        if(authorDM != undefined) {
          authorDM.send(sendObject).catch((err) => {
            console.error("Author's DM Closed");
          });
        }
        if(supportDM != undefined && supportDM != authorDM) {
          supportDM.send(sendObject).catch((err) => {
            console.error("Support's DM Closed");
          });
        }
      };
    };
    let dataRemove = db
      .all()
      .filter((i) => i.ID.includes(channel.id));

    dataRemove.forEach((x) => db.delete(x.ID));
  }
}

const textTranscript = async (client, channel, member, ticket, reason) => {
  let config = client.config;
  let ticketData = db.fetch(`ticketData_${channel.id}`);
  let write = fs.createWriteStream(`transcripts/ticket-${ticket}.txt`);
  channel.messages.fetch({ limit: 100 }).then((messages) => {
    let messages2 = messages;
    let me = messages2.sort((b, a) => b.createdTimestamp - a.createdTimestamp);

    me.forEach((msg) => {
      const time = msg.createdAt.toLocaleString();
      write.write(`[${time}] ${msg.author.tag}: ${msg.content}\n`);
    });
    write.end();
    
    if (config.server.selfhost.enabled == true) {
      let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
      db.set(`transcript_${ticket}`, transcriptCode);
    }
    let transcriptAccess = db.fetch(`transcript_${ticket}`) || 'N/A';
    
    let logEmbed = new Discord.MessageEmbed()
      .setColor(client.embeds.transcriptLog.color);

    if (client.embeds.transcriptLog.title) logEmbed.setTitle(client.embeds.transcriptLog.title);
    let field = client.embeds.transcriptLog.fields;
    for (let i = 0; i < client.embeds.transcriptLog.fields.length; i++) {
      logEmbed.addField(field[i].title, field[i].description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticket}`.replace("ticket-", ""))
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`))
    }

    if (client.embeds.transcriptLog.footer == true) logEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
    if (client.embeds.transcriptLog.thumbnail == true) logEmbed.setThumbnail(member.user.displayAvatarURL());

    if (client.embeds.transcriptLog.description) logEmbed.setDescription(client.embeds.transcriptLog.description.replace("<closedBy>", member.user)
      .replace("<ticketId>", `${ticket}`.replace("ticket-", ""))
      .replace("<author>", `<@${ticketData?.owner}>`)
      .replace("<reason>", reason)
      .replace("<channelId>", channel.id)
      .replace("<channelName>", channel.name)
      .replace("<transcriptCode>", transcriptAccess)
      .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
      .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));
    
    let aChannel = client.utils.findChannel(channel.guild, config.channels.transcripts);
    aChannel.send({ embeds: [logEmbed], files: [`transcripts/ticket-${ticket}.txt`] }).then(() => {
      setTimeout(async() => {
        if(channel) await channel.delete();
      }, client.config.general.delete_after * 1000);
    }); 

    if(config.general.dm_transcript == true) {
      let dmEmbed = new Discord.MessageEmbed()
        .setColor(client.embeds.dmTranscript.color);

      if(client.embeds.dmTranscript.title) dmEmbed.setTitle(client.embeds.dmTranscript.title);
      let field = client.embeds.dmTranscript.fields;
      for(let i = 0; i < client.embeds.dmTranscript.fields.length; i++) {
        dmEmbed.addField(field[i].title, field[i].description.replace("<closedBy>", member.user)
          .replace("<ticketId>", ticket)
          .replace("<author>", `<@${ticketData?.owner}>`)
          .replace("<reason>", reason)
          .replace("<channelId>", channel.id)
          .replace("<channelName>", channel.name)
          .replace("<transcriptCode>", transcriptAccess)
          .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
          .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`))
      }
      
      if(client.embeds.dmTranscript.footer == true) dmEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
      if(client.embeds.dmTranscript.thumbnail == true) dmEmbed.setThumbnail(member.user.displayAvatarURL());

      if(client.embeds.dmTranscript.description) dmEmbed.setDescription(client.embeds.dmTranscript.description.replace("<closedBy>", member.user)
        .replace("<ticketId>", ticket)
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));

      if(config.general.dm_transcript == true) {
        // let authorDM = db.fetch(`ticketOwner_${channel.id}`);
        let supportDM = db.fetch(`ticketClaimed_${channel.id}`);
        let authorDM = client.users.cache.get(ticketData?.owner);
        supportDM = client.users.cache.get(supportDM);
        if(authorDM != undefined) {
          authorDM.send({ embeds: [dmEmbed], files: [`transcripts/ticket-${ticket}.txt`] }).catch((err) => {
            console.error("Author's DM Closed");
          });
        }
        if(supportDM != undefined && supportDM != authorDM) {
          supportDM.send({ embeds: [dmEmbed], files: [`transcripts/ticket-${ticket}.txt`] }).catch((err) => {
            console.error("Support's DM Closed");
          });
        }
      };
    };
    let dataRemove = db
      .all()
      .filter((i) => i.ID.includes(channel.id));
    
    let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
    db.set(`transcript_${ticket}`, transcriptCode);

    dataRemove.forEach((x) => db.delete(x.ID));
  });
}

module.exports = {
  htmlTranscript,
  textTranscript,
}
