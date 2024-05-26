const Discord = require("discord.js");
const db = require("quick.db");
const fetch = require("node-fetch");

const modalAskQuestions = async(client, button, channel, questionsList, ticketCategory = {}) => {
  let config = client.config;
  if(questionsList.length == 0) return;
  const chunkSize = 5;
  const arrOfChunks = [];

  for (let i = 0; i < questionsList.length; i += chunkSize) {
    const chunk = questionsList.slice(i, i + chunkSize);
    arrOfChunks.push(chunk)
  }

  let modalArr = [];
  for (let i = 0; i < arrOfChunks.length; i++) {
    modalArr.push(arrOfChunks[i].map((x) => {
      let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
      let modalData = new Discord.MessageActionRow().addComponents(
        new Discord.TextInputComponent()
        .setLabel(x.name)
        .setStyle("PARAGRAPH")
        .setCustomId(`modalQuestion_${questionIndex}`)
        .setPlaceholder(x.question)
      );

      return modalData;
    }))
  }

  let startingPage = db.fetch(`questionPage_${channel.id}`) || 1;
  
  let questModal = new Discord.Modal()
    .setTitle(client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
    .setComponents(modalArr[startingPage - 1])
    .setCustomId("askQuestions_modal");

  let isAnswered = db.fetch(`questionsAnswered_${channel.id}`);
  
  if (isAnswered == true) {
    button.message.components[0].components.forEach((c) => {
      if(c.customId != "closeTicket" && c.customId != "claimTicket") c.setStyle("SECONDARY")
        .setLabel(client.language.buttons.answered_all)
        .setDisabled(true);
    });
    button.message.edit({ embeds: [button.message.embeds[0]], components: [button.message.components[0]] }).catch((err) => { });
    return;
  }

  button.showModal(questModal);

  const filter = (i) => i.customId == 'askQuestions_modal' && i.user.id == button.user.id;
  button.awaitModalSubmit({ filter, time: client.config.general.question_idle * 1000 })
    .then(async(interaction) => {
      let currPage = db.fetch(`questionPage_${channel.id}`);
      
      if (parseInt(currPage + 1) > modalArr.length || modalArr.length == 1) {
        await interaction.deferUpdate();
        
        if(modalArr.length <= 5) {
          interaction.components.map((v) => {
            let questionIndex = v.components[0].customId.split("_")[1];
            db.push(`channelQuestions_${channel.id}`, {
              question: questionsList[questionIndex].name,
              answer: v.components[0].value
            });
          });
        }
        
        db.set(`questionsAnswered_${channel.id}`, true);

        interaction.message.components[0].components.forEach((c) => {
          if(c.customId != "closeTicket" && c.customId != "claimTicket") c.setStyle("SECONDARY")
            .setLabel(client.language.buttons.answered_all)
            .setDisabled(true);
        });

        interaction.followUp({ embeds: [client.embedBuilder(client, interaction.user, client.embeds.title, client.language.ticket.answered_all, client.embeds.success_color)], ephemeral: true });
        interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [interaction.message.components[0]] });
        let answerData = db.fetch(`channelQuestions_${channel.id}`) || [];
        
        let submitEmbed = new Discord.MessageEmbed()
          .setTitle(ticketCategory.type == "COMMISSION" ? client.language.titles.commission : client.language.titles.answers)
          .setColor(client.embeds.general_color)
          .setFooter({ text: button.member.user.username, iconURL: button.member.user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp();

        for (let i = 0; i < answerData.length; i++) {
          submitEmbed.addField(answerData[i].question, answerData[i].answer == "" ? "N/A" : answerData[i].answer);
        }

        channel.permissionOverwrites.edit(button.user, {
          SEND_MESSAGES: true,
          VIEW_CHANNEL: true
        });

        interaction.followUp({ embeds: [submitEmbed] });
        
        if(config.general.send_commissions == true && config.channels.commissions != "" && ticketCategory.type == "COMMISSION") {
          submitEmbed.setTitle(client.embeds.service.newCommission.title)
            .setColor(client.embeds.service.newCommission.color);

          if(client.embeds.service.newCommission.description) submitEmbed.setDescription(client.embeds.service.newCommission.description.repalce("<user>", button.member.user));
          if(client.embeds.service.newCommission.thumbnail == true) submitEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
          if(client.embeds.service.newCommission.footer == true) submitEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

          let commChannel = client.utils.findChannel(channel.guild, config.channels.commissions);

          const commRow = new Discord.MessageActionRow()
            .addComponents(
              new Discord.MessageButton()
                .setStyle("SUCCESS")
                .setCustomId(`commission_${channel.id}`)
                .setLabel(client.language.buttons.send_quote)
                .setEmoji(config.emojis.send_quote)
            )
          
          if(commChannel) await commChannel.send({ embeds: [submitEmbed], components: [commRow] }).then((m) => {
            const commission = db.fetch(`commission_${channel.id}`);
            commission.commMessageId = m.id
            db.set(`commission_${channel.id}`, commission);
          });
        }
      } else {
        let questionPage = db.fetch(`questionPage_${channel.id}`);
        db.add(`questionPage_${channel.id}`, questionPage ? 1 : 2);
        questionPage = db.fetch(`questionPage_${channel.id}`);

        interaction.components.map((v) => {
          let questionIndex = v.components[0].customId.split("_")[1];
          db.push(`channelQuestions_${channel.id}`, {
            question: questionsList[questionIndex].name,
            answer: v.components[0].value
          });
        });

        questModal
          .setTitle(client.language.titles.questions.replace("<page>", parseInt(questionPage)).replace("<max>", modalArr.length))
          .setComponents(modalArr[parseInt(questionPage - 1)]);

        interaction.message.components[0].components.forEach((c) => {
          if(c.customId != "closeTicket" && c.customId != "claimTicket") 
            c.setLabel(client.language.buttons.answer_questions.replace("<page>", questionPage))
        });
        
        interaction.reply({ embeds: [client.embedBuilder(client, interaction.user, client.embeds.title, client.language.ticket.answered_set, client.embeds.general_color)], ephemeral: true });
        interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [interaction.message.components[0]] })
      }
    }).catch((err) => {
      channel.permissionOverwrites.edit(button.user, {
        SEND_MESSAGES: true,
        VIEW_CHANNEL: true
      });

      button.message.components[0].components.forEach((c) => {
        if(c.customId != "closeTicket" && c.customId != "claimTicket") c.setDisabled(true);
      });

      button.message.edit({ embeds: [button.message.embeds[0]], components: [button.message.components[0]] }).catch((err) => { });
    });
}

const chatAskQuestions = async(client, member, channel, questionsList, ticketCategory = {}) => {
  let config = client.config;
  if(questionsList.length == 0) return;
  let answersList = new Map();
  const filter = msg => msg.author.id === member.id;

  const collector = channel.createMessageCollector({ filter, idle: client.config.general.question_idle * 1000, max: questionsList.length });
  let questionNumber = 0;

  const cancelAsk = new Discord.MessageActionRow()
    .addComponents(
      new Discord.MessageButton().setCustomId("cancel_ask")
        .setEmoji("❌")
        .setStyle("DANGER")
    );

  let questionEmbed = new Discord.MessageEmbed()
    .setTitle(`${questionsList[questionNumber].name}`)
    .setDescription(`${questionsList[questionNumber].question}`)
    .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
    .setTimestamp()
    .setColor(client.embeds.general_color);
    
  let msg = await channel.send({ embeds: [questionEmbed], components: client.config.general.cancel_ask == true ? [cancelAsk] : [] });
    
  if(client.config.general.cancel_ask == true) {
    const awaitFilter = (i) => i.customId == "cancel_ask" && i.user.id == member.id;
    
    msg.awaitMessageComponent({ awaitFilter }).then(async (i) => {
      await i.deferUpdate();
      await msg.delete();
      collector.stop();
    }).catch((e) => {});
  }

  let content = "";
  collector.on('collect', async(m) => {
    if(m.content.length >= 1024) content = `${m.content.slice(0, 1021)}..`;
    else content = m.content;

    if(m.attachments.size > 0) {
      let attUrls = "";
      
      for(const att of m.attachments) {
        let uploaded = await uploadImage(att[1].url);
        attUrls += `\n` + uploaded.image.url;
      }

      if(m.content.length == 0) content = attUrls;
      else content += `\n\n` + attUrls;
    }

    answersList.set(questionsList[questionNumber].name, `${content}`);
    questionNumber++;
    m.delete();
    if(questionNumber < questionsList.length) {
      questionEmbed.setTitle(questionsList[questionNumber].name);
      questionEmbed.setDescription(questionsList[questionNumber].question);
      await msg.edit({ embeds: [questionEmbed], components: client.config.general.cancel_ask == true ? [cancelAsk] : [] });
    } else if(questionNumber == questionsList.length) {
      finalList = new Map(answersList)
      questionEmbed.setTitle(client.language.titles.answers);
      questionEmbed.setDescription(client.language.ticket.loading_answers);
      await msg.edit({ embeds: [questionEmbed], components: [] });

      let ansList = [];
      let answersArray = [...answersList.values()];
      let qAnswers = new Discord.MessageEmbed()
        .setTitle(ticketCategory.type == "COMMISSION" ? client.language.titles.commission : client.language.titles.answers)
        .setColor(client.embeds.general_color)
        .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      for(let i = 0; i < answersArray.length; i++) {
        qAnswers.addField(questionsList[i].name, answersArray[i]);
        ansList.push({
          question: questionsList[i].name,
          answer: answersArray[i]
        });
      }

      db.set(`channelQuestions_${channel.id}`, ansList);

      await msg.edit({ embeds: [qAnswers], components: [] });

      if(config.general.send_commissions == true && config.channels.commissions != "" && ticketCategory.type == "COMMISSION") {
        qAnswers.setTitle(client.embeds.service.newCommission.title)
          .setColor(client.embeds.service.newCommission.color);

        if(client.embeds.service.newCommission.description) qAnswers.setDescription(client.embeds.service.newCommission.description.replace("<user>", member.user));
        if(client.embeds.service.newCommission.thumbnail == true) qAnswers.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        if(client.embeds.service.newCommission.footer == true) qAnswers.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

        let commChannel = client.utils.findChannel(channel.guild, config.channels.commissions);

        const commRow = new Discord.MessageActionRow()
          .addComponents(
            new Discord.MessageButton()
              .setStyle("SUCCESS")
              .setCustomId(`commission_${channel.id}`)
              .setLabel(client.language.buttons.send_quote)
              .setEmoji(config.emojis.send_quote)
          )

        if(commChannel) await commChannel.send({ embeds: [qAnswers], components: [commRow] }).then((m) => {
          const commission = db.fetch(`commission_${channel.id}`);
          commission.commMessageId = m.id
          db.set(`commission_${channel.id}`, commission);
        });
      }

      collector.stop();
    }
  });

  collector.on('end', async (collected, reason) => {
    if(reason.toLowerCase() == "idle") {
      let idleEmbed = new Discord.MessageEmbed()
        .setDescription(client.language.ticket.question_idle)
        .setColor(client.embeds.general_color);
        
      channel.send({ embeds: [idleEmbed] });
    }
  });
}

const uploadImage = (url) => {
  return fetch(`https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5&source=${url}`, {
      method: "POST", 
  }).then((res) => res.json());
}

module.exports = {
  modalAskQuestions,
  chatAskQuestions
}