const db = require("quick.db");
const Discord = require("discord.js");
const fs = require("fs");
const chalk = require("chalk");
const FormData = require("form-data");
const axios = require("axios");
const yaml = require("js-yaml");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM();
const document = dom.window.document;

function formatTime(ms) {
  let roundNumber = ms > 0 ? Math.floor : Math.ceil;
  let days = roundNumber(ms / 86400000),
    hours = roundNumber(ms / 3600000) % 24,
    mins = roundNumber(ms / 60000) % 60,
    secs = roundNumber(ms / 1000) % 60;
  var time = (days > 0) ? `${days}d ` : "";
  time += (hours > 0) ? `${hours}h ` : "";
  time += (mins > 0) ? `${mins}m ` : "";
  time += (secs > 0) ? `${secs}s` : "0s";
  return time;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const updateStats = (client, guild) => {
  let currentTickets = db
    .all()
    .filter((i) => i.ID.startsWith("tickets_"));
  let claimedTickets = db.fetch(`claimedTickets_${guild.id}`) || 0;
  let totalTickets = db.fetch(`ticketCount_${guild.id}`) || 0;

  let chOpened = db.fetch(`openedChannel_${guild.id}`);
  let chClaimed = db.fetch(`claimedChannel_${guild.id}`);
  let chTotal = db.fetch(`totalChannel_${guild.id}`);

  if(chOpened != null && guild.channels.cache.get(chOpened)) {
    let ch = guild.channels.cache.get(chOpened);
    ch.setName(ch.name.replace(/[0-9]/g, "") + currentTickets.length);
  }
  if(chClaimed != null && guild.channels.cache.get(chClaimed)) {
    let ch = guild.channels.cache.get(chClaimed);
    ch.setName(ch.name.replace(/[0-9]/g, "") + claimedTickets);
  }
  if(chTotal != null && guild.channels.cache.get(chTotal)) {
    let ch = guild.channels.cache.get(chTotal);
    ch.setName(ch.name.replace(/[0-9]/g, "") + totalTickets);
  }
}

function commandsList(client, category) {
  prefix = client.config.general.prefix;
  let commands = client.commands.filter(
    c => c.category == category && c.listed == true
  );

  let loaded = [...commands.values()];
  let content = "";

  loaded.forEach(
    c => (content += `\`${c.name}\`, `)
  );
  if(content.length == 0) content = client.language.general.no_commands + ", ";

  return content.slice(0, -2);
}

const pushReview = (message, userId, object) => {
  let history = db.fetch(`reviews_${message.guild.id}_${userId}`) || [];
  history.unshift(object);
  db.set(`reviews_${message.guild.id}_${userId}`, history);
}

function generateId() {
  var firstPart = (Math.random() * 46656) | 0;
  var secondPart = (Math.random() * 46656) | 0;
  firstPart = ("000" + firstPart.toString(36)).slice(-3);
  secondPart = ("000" + secondPart.toString(36)).slice(-3);
  return firstPart + secondPart;
}

const sendError = (error) => {
  console.log(chalk.red("[ERROR] ") + chalk.white(error));

  let errorMessage = `[${new Date().toLocaleString()}] [ERROR] ${error}\n`;

  fs.appendFile("./info.txt", errorMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendWarn = (warn) => {
  console.log(chalk.keyword("orange")("[WARNING] ") + chalk.white(warn));

  let warnMessage = `[${new Date().toLocaleString()}] [WARN] ${warn}\n`;

  fs.appendFile("./info.txt", warnMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendInfo = (info) => {
  console.log(chalk.blue("[INFO] ") + chalk.white(info));
}

const findChannel = (guild, channel) => {
  if(channel == "") return undefined;

  return guild.channels.cache.find(ch => ch.name.toLowerCase().includes(`${channel}`.toLowerCase())) || guild.channels.cache.get(channel);
}

const usage = (client, message, validUsage) => {
  let embed = client.embedBuilder(client, message.member.user, client.embeds.title, client.language.general.usage.replace("<usage>", validUsage), client.embeds.error_color);
  return embed;
}

const findRole = (guild, role) => {
  if(role == "") return undefined;

  return guild.roles.cache.find(r => r.name.toLowerCase().includes(`${role}`.toLowerCase())) || guild.roles.cache.get(role);
}

const hasRole = (client, guild, member, roles, checkEmpty = false) => {
  if(checkEmpty == true && roles.length == 0) return true;

  let arr = roles.map((x, i) => {
    let findPerm = client.utils.findRole(guild, `${x}`.toLowerCase());
    if(!findPerm) return false;
    if(member.roles.cache.has(findPerm.id)) return true;

    return false;
  });
  if(checkEmpty == true && arr.length == 0) return true;

  return arr.includes(true) ? true : false;
}

const hasPermissions = (message, member, permList) => {
  if(permList.length == 0) return true;
  
  let userPerms = [];
  permList.forEach((perm) => {
    if(!Discord.Permissions.FLAGS[perm]) return userPerms.push(true);
    if(!message.channel.permissionsFor(member).has(perm)) return userPerms.push(false);
    else return userPerms.push(true);
  });

  return userPerms.includes(true) ? true : false;
}

const filesCheck = () => {
  if(!fs.existsSync('./info.txt')) {
    fs.open('./info.txt', 'w', function(err, file) {
      if(err) sendError("Couldn't create file (info.txt)");
      sendInfo("File (info.txt) doesn't exist, creating it.");
    });
  }
  if(!fs.existsSync('./transcripts')) {
    fs.mkdir('./transcripts', function(err) {
      if(err) sendError("Couldn't create folder (transcripts)");
      sendInfo("Folder (transcripts) doesn't exist, creating it.");
    })
  }
  if(!fs.existsSync('./products')) {
    fs.mkdir('./products', function(err) {
      if(err) sendError("Couldn't create folder (products)");
      sendInfo("Folder (products) doesn't exist, creating it.");
    })
  }
}

const generateTranscript = async (channel, msgs, ticket) => {
  let ticketData = db.fetch(`ticketData_${channel.id}`);
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  await fs.writeFileSync(`transcripts/${ticket}.html`, data)
  let guildElement = document.createElement('div');

  let guildNameEl = document.createElement("span");
  let guildText = document.createTextNode(channel.guild.name);

  let openEl = document.createElement("span");
  let openText = document.createTextNode('Creation Date: ' + new Date(parseInt(ticketData?.openedTimestamp || new Date().getTime())).toLocaleString() || 'N/A')
  openEl.appendChild(openText);
  openEl.style = `display: flex; padding-top: 15px; font-size: 15px;`

  let closeEl = document.createElement("span");
  let closeText = document.createTextNode('Closing Date: ' + new Date().toLocaleString() || 'N/A')
  closeEl.appendChild(closeText);
  closeEl.style = `display: flex; padding-top: 5px; font-size: 15px;`

  guildNameEl.appendChild(guildText);
  guildNameEl.appendChild(openEl)
  guildNameEl.appendChild(closeEl)
  guildNameEl.style = `margin-left: 43px`
  guildNameEl.style = `margin-top: 45px`

  let guildImg = document.createElement('img');
  guildImg.setAttribute('src', channel.guild.iconURL());
  guildImg.setAttribute('width', '128');
  guildImg.className = "guild-image";
  guildElement.appendChild(guildImg);
  guildElement.appendChild(guildNameEl);
  guildElement.style = "display: flex"
  await fs.appendFileSync(`transcripts/${ticket}.html`, guildElement.outerHTML, (err) => {
    if(err) console.log(err)
  });

  msgs.forEach(async(msg) => {
    let parentContainer = document.createElement("div");
    parentContainer.className = "parent-container";

    let avatarDiv = document.createElement("div");
    avatarDiv.className = "avatar-container";
    let img = document.createElement('img');
    img.setAttribute('src', msg.author.displayAvatarURL());
    img.className = "avatar";
    avatarDiv.appendChild(img);

    parentContainer.appendChild(avatarDiv);

    let messageContainer = document.createElement('div');
    messageContainer.className = "message-container";

    let nameElement = document.createElement("span");
    let name = document.createTextNode(`${msg.author.tag} `)
    let dateSpan = document.createElement("span");
    let dateText = document.createTextNode(`${msg.createdAt.toLocaleString()}`)
    dateSpan.appendChild(dateText)
    dateSpan.style = `font-size: 12px; color: #c4c4c4;`
    nameElement.appendChild(name);
    nameElement.appendChild(dateSpan)
    nameElement.style = `padding-bottom: 10px`
    messageContainer.append(nameElement);

    if(msg.content.startsWith("```")) {
      let m = msg.content.slice(3, -3);
      let codeNode = document.createElement("code");
      let textNode = document.createTextNode(m);
      codeNode.appendChild(textNode);
      messageContainer.appendChild(codeNode);
    } else if(msg.embeds[0]) {
      let fields = [];
      for (let i = 0; i < msg.embeds[0].fields.length; i++) {
        fields.push(
          `<b><font size="+1">${msg.embeds[0].fields[i].name}</font></b><br>${msg.embeds[0].fields[i].value}<br>`
        )
      }
      let msgEmbed = msg.embeds[0];
      let embedNode = document.createElement("div");
      embedNode.className = "embed";

      let colorNode = document.createElement("div");
      colorNode.className = "embed-color";
      colorNode.style = `background-color: ${msgEmbed.hexColor}`;
      embedNode.appendChild(colorNode);
      let embedContent = document.createElement("div");
      embedContent.className = "embed-content";

      let titleNode = document.createElement("span");
      titleNode.className = "embed-title";
      titleNode.innerHTML = msgEmbed.title;
      embedContent.appendChild(titleNode);

      if(msgEmbed.fields[0]) {
        let descNode = document.createElement("span");
        if(msgEmbed.description) {
          let boldContent = msgEmbed.description.match(/\*\*([^]*?)\*\*/g);
          let boldReg = /\*/g;
          if(boldContent) boldContent.forEach((x) => msgEmbed.description = msgEmbed.description.replace(x, `<b>${x.replace(boldReg, '')}</b>`))
        }
        let fieldDes = msgEmbed.description ? msgEmbed.description : '';
        descNode.className = "embed-description";
        descNode.innerHTML = fieldDes + '\n' + fields.join("<br>");
        embedContent.appendChild(descNode);
      } else {
        if(!msgEmbed.description) msgEmbed.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        let boldContent = msgEmbed.description.match(/\*\*([^]*?)\*\*/g);
        let boldReg = /\*/g;
        if(boldContent) boldContent.forEach((x) => msgEmbed.description = msgEmbed.description.replace(x, `<b>${x.replace(boldReg, '')}</b>`))
        msgEmbed.description = msgEmbed.description.replace(/<@\d{18}>/g, us => channel.guild.members.cache.get(us.match(/\d+/) ? us.match(/\d+/)[0] : '')?.user.tag || 'invalid-user');
        msgEmbed.description = msgEmbed.description.replace(/<@&\d{18}>/g, ro => channel.guild.roles.cache.get(ro.match(/\d+/) ? ro.match(/\d+/)[0] : '')?.name || 'deleted-role');
        msgEmbed.description = msgEmbed.description.replace(/<#\d{18}>/g, ch => channel.guild.channels.cache.get(ch.match(/\d+/) ? ch.match(/\d+/)[0] : '')?.name || 'deleted-channel');

        descNode.innerHTML = msgEmbed.description.replace("\n", "<br>");
        embedContent.appendChild(descNode);
      }
      embedNode.appendChild(embedContent);
      messageContainer.append(embedNode);
    } else {
      let msgNode = document.createElement('span');
      let boldContent = msg.content.match(/\*\*([^]*?)\*\*/g);
      let boldReg = /\*/g;
      if(boldContent) boldContent.forEach((x) => msg.content = msg.content.replace(x, `<b>${x.replace(boldReg, '')}</b>`))
      msg.content = msg.content.replace(/<@\d{18}>/g, us => channel.guild.members.cache.get(us.match(/\d+/) ? us.match(/\d+/)[0] : '')?.user.tag || 'invalid-user');
      msg.content = msg.content.replace(/<@&\d{18}>/g, ro => channel.guild.roles.cache.get(ro.match(/\d+/) ? ro.match(/\d+/)[0] : '')?.name || 'deleted-role');
      msg.content = msg.content.replace(/<#\d{18}>/g, ch => channel.guild.channels.cache.get(ch.match(/\d+/) ? ch.match(/\d+/)[0] : '')?.name || 'deleted-channel');

      let textNode = document.createTextNode(msg.content);
      msgNode.append(textNode);
      messageContainer.appendChild(msgNode);
    }

    parentContainer.appendChild(messageContainer);
    await fs.appendFileSync(`transcripts/${ticket}.html`, parentContainer.outerHTML, (err) => {
      if(err) console.log(err)
    });
  });
}

const channelRoleCheck = (client, usedGuild, foundWarn) => {
  const config = client.config;
  if(client.config.category.separateRoles.enabled == true && client.config.categories.length > 0) {
    for (let i = 0; i < client.config.categories.length; i++) {
      if(client.config.categories[i].roles.length == 0) continue;
      let findRole = client.config.categories[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn("One or more Category Roles (categories.CATEGORY.roles) provided are invalid or belongs to other Server.");
        foundWarn.push("Invalid Category Role");
        break;
      }
    }
  }
  if(client.config.roles.support.length > 0) {
    for (let i = 0; i > client.config.roles.support.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.support[i]);
      if(!findRole) {
        client.utils.sendWarn("One or more Support Roles (roles.support) provided are invalid or belongs to other Server.");
        foundWarn.push("Invalid Support Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.cooldown.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.cooldown.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.cooldown[i]);
      if(!findRole) {
        client.utils.sendWarn("One or more Cooldown Bypass Roles (roles.bypass.cooldown) provided are invalid or belongs to other Server.");
        foundWarn.push("Invalid Cooldown Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.permission.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.permission.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.permission[i]);
      if(!findRole) {
        client.utils.sendWarn("One or more Permission Bypass Roles (roles.bypass.permission) provided are invalid or belongs to other Server.");
        foundWarn.push("Invalid Permission Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.sellix.separateProducts.enabled == true && client.config.sellix.products > 0) {
    for (let i = 0; i < client.config.sellix.products.length; i++) {
      if(client.config.sellix.products[i].roles.length == 0) continue;
      let findRole = client.config.sellix.products[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn("One or more Sellix Product Verification Roles (sellix.products.PRODUCT.roles) provided are invalid or belongs to other Server.");
        foundWarn.push("Invalid Sellix Verification Role(s)");
        break;
      }
    }
  }
  if(config.channels.transcripts != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.transcripts);
    if(!findChannel) {
      client.utils.sendWarn("Transcripts Channel Name/ID (transcripts) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Transcripts Channel");
    }
  }
  if(config.channels.suggestions != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.suggestions);
    if(!findChannel) {
      client.utils.sendWarn("Suggestions Channel Name/ID (suggestions) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Channel");
    }
  }
  if(config.channels.sugg_logs != "" && config.general.sugg_decision == true) {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.sugg_logs);
    if(!findChannel) {
      client.utils.sendWarn("Suggestion Logs Channel Name/ID (sugg_logs) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Logs Channel");
    }
  }
  if(config.channels.sugg_decision != "" && config.general.sugg_decision == true) {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.sugg_logs);
    if(!findChannel) {
      client.utils.sendWarn("Suggestion Decision Channel Name/ID (sugg_decision) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Decision Channel");
    }
  }
  if(config.channels.announce != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.announce);
    if(!findChannel) {
      client.utils.sendWarn("Auto Announcements Channel Name/ID (announce) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Auto Announcements Channel");
    }
  }
  if(config.channels.reviews != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.reviews);
    if(!findChannel) {
      client.utils.sendWarn("Reviews Channel Name/ID (reviews) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Reviews Channel");
    }
  }
  if(!Array.isArray(client.config.roles.support)) {
    client.utils.sendWarn("Config field for Support Roles (roles.support) is not of proper type (Array).");
    foundWarn.push("Invalid Support Roles Config Field Type");
  }
  if(!Array.isArray(client.config.roles.blacklist)) {
    client.utils.sendWarn("Config field for Blacklisted Users (roles.blacklist) is not of proper type (Array).");
    foundWarn.push("Invalid Blacklisted Users Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.cooldown)) {
    client.utils.sendWarn("Config field for Cooldown Bypass (roles.bypass.cooldown) is not of proper type (Array).");
    foundWarn.push("Invalid Cooldown Bypass Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.permission)) {
    client.utils.sendWarn("Config field for Permission Bypass (roles.bypass.permission) is not of proper type (Array).");
    foundWarn.push("Invalid Permission Bypass Config Field Type");
  }
}

const ticketUsername = (user) => {
  const regex = /[^a-z0-9]+/g
  const format = user.username.toLowerCase().replace(regex, "");
  return format == "" ? `${user.id}` : format;
}

const ticketPlaceholders = (string, user, ticket) => {
  if(ticket < 10) ticket = "000" + ticket;
  else if(ticket >= 10 && ticket < 100) ticket = "00" + ticket
  else if(ticket >= 100 && ticket < 1000) ticket = "0" + ticket
  else if(ticket >= 1000) ticket = ticket;

  return string.toLowerCase().replace("<username>", ticketUsername(user)).replace("<ticket>", ticket);
}

const downloadProduct = async (client, message, product) => {
  let productList = yaml.load(fs.readFileSync('./configs/products.yml', 'utf8'));
  if(productList.products[product].type == "FILE") {
    let data = new FormData();
    data.append("file", fs.createReadStream(`products/${productList.products[product].product}`).on('data', (chunk) => {}), `products/${productList.products[product].product}`);
    data.append("datetime", client.config.products.delete_download);
    data.append("limit", client.config.products.limit_download)

    axios.post('https://tempfile.site/api/files', data, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: data.getHeaders(),
      })
      .then(async (res) => {
        const row = new Discord.MessageActionRow()
          .addComponents(
            new Discord.MessageButton()
            .setStyle("PRIMARY")
            .setLabel(client.language.buttons.download)
            .setEmoji(client.config.emojis.file)
            .setCustomId('downloadFiles'),
          );

        if(message.type == "APPLICATION_COMMAND") {
          m = await message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download_get.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row], ephemeral: client.cmdConfig.getproduct.ephemeral });
        } else {
          m = await message.channel.send({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download_get.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row], ephemeral: client.cmdConfig.getproduct.ephemeral });
        }
        const filter = (interaction) => interaction.customId == 'downloadFiles' && interaction.user.id == message.member.user.id;
        await message.channel.awaitMessageComponent({ filter, componentType: "BUTTON", max: 1 }).then(async (i) => {
          await i.deferUpdate({ ephemeral: true });
          const downloadFile = new Discord.MessageActionRow()
            .addComponents(
              new Discord.MessageButton()
              .setStyle("LINK")
              .setLabel(client.language.buttons.download)
              .setEmoji(client.config.emojis.file)
              .setURL(res.data.link)
            );
          await i.followUp({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [downloadFile], ephemeral: true })
        });
      }).catch((err) => {
        client.utils.sendError(err);
        if(message.type == "APPLICATION_COMMAND") {
          message.reply({ embeds: [this.client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.error, client.embeds.error_color)], ephemeral: true })
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(client, message.author, client.embeds.title, client.language.products.error, client.embeds.error_color)] })
        }
      });
  } else if(productList.products[product].type == "LINK") {
    const row = new Discord.MessageActionRow()
      .addComponents(
        new Discord.MessageButton()
        .setStyle("PRIMARY")
        .setLabel(client.language.buttons.link)
        .setEmoji(client.config.emojis.link)
        .setCustomId('getLink'),
      );

    if(message.type == "APPLICATION_COMMAND") {
      message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link_get.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row] });
    } else {
      message.channel.send({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link_get.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row] });
    }
    const filter = (interaction) => interaction.customId == 'getLink' && interaction.user.id == message.member.user.id;
    await message.channel.awaitMessageComponent({ filter, componentType: "BUTTON", max: 1 }).then(async (i) => {
      await i.deferUpdate({ ephemeral: true });
      const visitLink = new Discord.MessageActionRow()
        .addComponents(
          new Discord.MessageButton()
          .setStyle("LINK")
          .setLabel(client.language.buttons.link)
          .setEmoji(client.config.emojis.link)
          .setURL(`${productList.products[product].product}`)
        );
      await i.followUp({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [visitLink], ephemeral: true })
    });
  }
}

const isTicket = (client, channel) => {
  const ticketData = db.fetch(`ticketData_${channel.id}`);
  return ticketData != null ? true : false;
}

const updateSuggestionEmbed = async (client, interaction) => {
  let suggData = db.fetch(`suggestion_${interaction.guild.id}_${interaction.message.id}`);
  let suggChannel = client.utils.findChannel(interaction.guild, client.config.channels.suggestions);
  let decisionChannel = client.utils.findChannel(interaction.guild, client.config.channels.sugg_decision);

  let suggMenu = new Discord.MessageEmbed()
    .setColor(client.embeds.suggestion.color);

  if(client.embeds.suggestion.title) suggMenu.setTitle(client.embeds.suggestion.title);
  let field = client.embeds.suggestion.fields;
  for (let i = 0; i < client.embeds.suggestion.fields.length; i++) {
    suggMenu.addField(field[i].title, field[i].description.replace("<author>", `<@!${suggData.author.id}>`)
      .replace("<suggestion>", suggData.text)
      .replace("<yes_vote>", suggData.yes)
      .replace("<no_vote>", suggData.no)
      .replace("<date>", suggData.date))
  }

  if(client.embeds.suggestion.footer == true) suggMenu.setFooter({ text: suggData.author.username, iconURL: suggData.author.displayAvatarURL }).setTimestamp();
  if(client.embeds.suggestion.thumbnail == true) suggMenu.setThumbnail(interaction.guild.iconURL());

  if(client.embeds.suggestion.description) suggMenu.setDescription(client.embeds.suggestion.description.replace("<author>", `<@!${suggData.author.id}>`)
    .replace("<suggestion>", suggData.text)
    .replace("<yes_vote>", suggData.yes)
    .replace("<no_vote>", suggData.no)
    .replace("<date>", suggData.date));

  let suggRow = new Discord.MessageActionRow().addComponents(
    new Discord.MessageButton()
      .setLabel(client.language.buttons.yes_vote.replace("<count>", suggData.yes))
      .setEmoji(client.config.emojis.yes_emoji)
      .setCustomId("vote_yes")
      .setStyle("PRIMARY"),
    new Discord.MessageButton()
      .setLabel(client.language.buttons.no_vote.replace("<count>", suggData.no))
      .setEmoji(client.config.emojis.no_emoji)
      .setCustomId("vote_no")
      .setStyle("DANGER"),
    new Discord.MessageButton()
      .setLabel(client.language.buttons.remove_vote)
      .setEmoji(client.config.emojis.remove_vote)
      .setCustomId("vote_reset")
      .setStyle("SECONDARY")
  );

  let decisionRow = new Discord.MessageActionRow().addComponents(
    new Discord.MessageSelectMenu()
    .setCustomId("decision_menu")
    .setPlaceholder(client.language.general.suggestions.placeholder)
    .addOptions([{
      label: client.language.general.suggestions.decision.accept,
      value: "decision_accept",
      emoji: client.config.emojis.yes_emoji
      }, {
      label: client.language.general.suggestions.decision.deny,
      value: "decision_deny",
      emoji: client.config.emojis.no_emoji
      }, {
      label: client.language.general.suggestions.decision.delete,
      value: "decision_delete",
      emoji: client.config.emojis.remove_vote
      }])
  );

  let suggMessage = await suggChannel.messages.fetch(interaction.message.id);
  await suggMessage.edit({ embeds: [suggMenu], components: [suggRow] });
  if(client.config.channels.sugg_decision && client.config.general_sugg_decision) {
    let decisionMessage = await decisionChannel.messages.fetch(suggData.decision);
    if(decisionMessage) await decisionMessage.edit({ embeds: [suggMenu], components: [decisionRow] });
  }
}

const deleteUnusedData = (client) => {
  sendInfo("Deleting unused data from Database");

  let removeChoosing = db
    .all()
    .filter((i) => i.ID.startsWith("choosingCategory_")) || [];
  removeChoosing.forEach((x) => db.delete(x.ID));

  let removeDeleted = db
    .all()
    .filter((i) => i.ID.startsWith("ticketCategory_")) || [];
  removeDeleted.forEach((x) => {
    let removedChannel = x.ID.split("_")[1];
    if(!client.channels.cache.get(removedChannel)) {
      db.delete(x.ID);
    }
  });

  let ticketList = db
    .all()
    .filter((i) => i.ID.startsWith("tickets_")) || [];
  if(ticketList.length > 0) {
    ticketList.forEach((x) => {
      if(x?.data !== "[]") {
        if(typeof x.data == "string") x.data = JSON.parse(x.data);
        x.data.forEach((j) => {
          if(!client.channels.cache.get(j.channel)) {
            x.data = x.data.filter((d) => d.channel != j.channel)
            db.set(x.ID, x.data);
          }
        })
      }
    });
  }

  let ticketData = db
    .all()
    .filter((i) => i.ID.startsWith("ticketOwner_"));
  let ticketCount = db
    .all()
    .filter((i) => i.ID.startsWith("ticket_"));

  if(ticketData.length > 0 || ticketCount.length > 0) sendInfo("Migrating old Ticket Data to the new Format");
    
  ticketCount.forEach((x) => {
    let idGuild = x.ID.split("_")[1];

    db.set(`ticketCount_${idGuild}`, parseInt(x.data))
    db.delete(x.ID);
  })

  ticketData.forEach((x) => {
    let channelId = x.ID.split("_")[1];
    let ticketInfo = db.fetch(`ticketData_${channelId}`) || {};
    if(!ticketInfo.owner) ticketInfo.owner = JSON.parse(x.data);
    let openedAt = db.fetch(`openedAt_${channelId}`);
    let openedTimestamp = db.fetch(`openedTimestamp_${channelId}`);
    if(!ticketInfo.openedAt) ticketInfo.openedAt = openedAt;
    if(!ticketInfo.openedTimestamp) ticketInfo.openedTimestamp = openedTimestamp;
    if(!ticketInfo.id) ticketInfo.id = Math.floor(Math.random() * 19571);

    db.set(`ticketData_${channelId}`, ticketInfo);
    db.delete(`openedTimestamp_${channelId}`);
    db.delete(`openedAt_${channelId}`);
    db.delete(x.ID)
  })
}

const canEditName = async(guild, channel) => {
  let canEdit = true;
  await guild.fetchAuditLogs({ type: "ChannelUpdate" }).then((audit) => {
    let aLogs = audit.entries.filter(x => x.target.id == channel.id)
      .map((x) => x.changes.find((c) => c.key == "name") ? x.createdTimestamp : undefined).filter((i) => i != undefined);
    if(aLogs.length > 0) {
      let passedTen = new Date() - new Date(aLogs[0]);
      if(passedTen > 660_000) canEdit = true;
      else canEdit = false;
    }
  });

  return canEdit;
}

module.exports = {
  formatTime,
  capitalizeFirstLetter,
  commandsList,
  pushReview,
  generateId,
  updateStats,
  sendError,
  findChannel,
  usage,
  findRole,
  channelRoleCheck,
  hasRole,
  ticketUsername,
  sendWarn,
  filesCheck,
  downloadProduct,
  isTicket,
  hasPermissions,
  updateSuggestionEmbed,
  generateTranscript,
  ticketPlaceholders,
  canEditName,
  deleteUnusedData,
}
