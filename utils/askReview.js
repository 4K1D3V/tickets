const Discord = require("discord.js");
const db = require("quick.db");

module.exports = async(client, channel, guild) => {
  const config = client.config;
  const language = client.language;
  if(config.general.ask_review == false) return;
  const ticketData = db.fetch(`ticketData_${channel.id}`);
  const claimedBy = db.fetch(`ticketClaimed_${channel.id}`) || db.fetch(`autoClaim_${channel.id}`) || null;
  const user = client.users.cache.get(ticketData?.owner);
  if(!user || claimedBy == null) return;
  let dataReview = {
    user,
    comment: "",
    stars: 0
  }
  
  let selectRow = new Discord.MessageActionRow().addComponents(
    new Discord.MessageSelectMenu()
      .setCustomId("rate_select_menu")
      .setPlaceholder(language.service.reviews.placeholder)
      .addOptions([{
        label: "One Star",
        value: "1",
        emoji: "1️⃣"
      }, {
        label: "Two Stars",
        value: "2",
        emoji: "2️⃣"
      }, {
        label: "Three Stars",
        value: "3",
        emoji: "3️⃣"
    }, {
       label: "Four Stars",
       value: "4",
       emoji: "4️⃣"
    }, {
       label: "Five Stars",
       value: "5",
       emoji: "5️⃣"
    }])
  );

  let cancelRow = new Discord.MessageActionRow()
    .addComponents(
      new Discord.MessageButton()
        .setCustomId("review_cancel")
        .setStyle("DANGER")
        .setEmoji("❌")
    );
  
  let rateMsg;
  setTimeout(async() => {
    rateMsg = await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [selectRow, cancelRow] }).catch((err) => {
      return console.error("User's DM Closed");
    });
  }, 2500);
  
  const dm = await user.createDM();
  
  let rateFilter = (i) => i.channel.type == "DM" && i.user.id == user.id;
  let rateCollector = await dm.createMessageComponentCollector({ filter: rateFilter, time: 300_000 });
  
  rateCollector.on("collect", async(i) => {
    if(i.type == "MESSAGE_COMPONENT" && i.customId == "rate_select_menu") {
      let value = i.values[0];
      if(!isNaN(value)) {
        rateMsg.components[0].components[0].setDisabled(true);
        await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [rateMsg.components[0]] });
        
        dataReview.stars = value;
        let commentInput = new Discord.MessageActionRow()
          .addComponents(
            new Discord.TextInputComponent()
            .setCustomId("review_comment")
            .setLabel(language.modals.labels.comment)
            .setPlaceholder(language.modals.placeholders.comment)
            .setMinLength(6)
            .setRequired(true)
            .setStyle("PARAGRAPH")
          );
        
        let commentModal = new Discord.Modal()
          .setTitle(language.titles.review)
          .setCustomId("comment_modal")
          .addComponents(commentInput);
          
        i.showModal(commentModal);
        
        rateCollector.stop("collected");
      
        const filter = (i) => i.customId == 'comment_modal';
        i.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
          let commentValue = md.fields.getTextInputValue("review_comment").split(/\r?\n/)
            .filter(line => line.trim() !== "")
            .join("\n");
          
          dataReview.comment = commentValue || "";
          
          await md.reply({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.sent, client.embeds.success_color)] });
          
          let rId = client.utils.generateId();
          
          let rObject = {
            id: rId,
            author: user.id,
            user: claimedBy,
            rating: dataReview.stars,
            comment: dataReview.comment,
            date: new Date()
          }

          const review = "⭐".repeat(Math.floor(dataReview.stars));
          
          client.utils.pushReview(channel, claimedBy, rObject);
          
          let announceEmbed = new Discord.MessageEmbed()
            .setColor(client.embeds.service.review.color);
          
          if (client.embeds.service.review.title) announceEmbed.setTitle(client.embeds.service.review.title);
          
          if (client.embeds.service.review.description) announceEmbed.setDescription(client.embeds.service.review.description.replace("<author>", user)
            .replace("<user>", `<@!${claimedBy}>`)
            .replace("<review>", review)
            .replace("<date>", new Date().toLocaleString())
            .replace("<comment>", dataReview.comment));
          
          let field = client.embeds.service.review.fields;
          for (let i = 0; i < client.embeds.service.review.fields.length; i++) {
            announceEmbed.addField(field[i].title, field[i].description.replace("<author>", user)
              .replace("<user>", `<@!${claimedBy}>`)
              .replace("<date>", new Date().toLocaleString())
              .replace("<review>", review)
              .replace("<comment>", dataReview.comment), false)
          }
          
          if (client.embeds.service.review.footer == true) announceEmbed.setFooter({ text: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
          if (client.embeds.service.review.thumbnail == true) announceEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
          
          let reviewCh = client.utils.findChannel(guild, client.config.channels.reviews);
          if(reviewCh) reviewCh.send({ embeds: [announceEmbed] });
        
          rateCollector.stop("collected");
        }).catch(async(err) => {
          await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.time, client.embeds.success_color)] }).catch((err) => console.log("User's DM Closed"));
        });
      }
    } else if(i.type == "MESSAGE_COMPONENT" && i.customId == "review_cancel") {
      await i.deferUpdate();
      rateMsg.components[0].components[0].setDisabled(true);
      await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [rateMsg.components[0]] });
        
      user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.cancel, client.embeds.success_color)] });
      rateCollector.stop("canceled");
    }
  });

  rateCollector.on("end", async(collected, reason) => {
    if(reason != "collected" && reason != "canceled") {
      rateMsg.components[0].components[0].setDisabled(true);
      if(rateMsg) await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [rateMsg.components[0]] });
      
      await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.time, client.embeds.success_color)] }).catch((err) => console.log("User's DM Closed"));
    }
  });
}
