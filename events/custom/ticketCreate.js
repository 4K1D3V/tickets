const db = require("quick.db");
const Event = require("../../structures/Events");
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, Permissions } = require("discord.js");
const { chatAskQuestions } = require("../../utils/askQuestions");

module.exports = class TicketCreate extends Event {
  constructor(...args) {
    super(...args);
  }

  async run(message, member, reason = "No Reason Provided", separatedPanel = {
    status: false,
    cat_id: "n/a"
  }) {
    let config = this.client.config;
    let language = this.client.language;
    let mainCategory = this.client.utils.findChannel(message.guild, config.channels.category_id);
    if(!mainCategory) this.client.utils.sendError("Provided Channel Category ID (category_id) is invalid or belongs to other Server.");
    let everyone = message.guild.roles.cache.find(r => r.name === "@everyone");

    const componentList = (row, select = null) => {
      if(config.general.close_button == false) row.components = row.components.filter((x) => x.customId != "closeTicket");
      if(config.general.claim_button == false) row.components = row.components.filter((x) => x.customId != "claimTicket");

      if(select) return row.components.length == 0 ? [select] : [select, row];

      return row.components.length == 0 ? [] : [row];
    }
    
    if(config.category.status == false) {
      let memberTicket = db.fetch(`tickets_${member.id}`) || [];
      
      if(memberTicket.length >= config.general.ticket_limit) {
        if(message.type == "APPLICATION_COMMAND") {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else if(message.type == "MESSAGE_COMPONENT") {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    } else if(config.category.status == true && config.category.separateCategories == true) {
      let memberTicket = db.fetch(`tickets_${member.id}`) || [];
      let userTickets = memberTicket.filter((x) => x.member == member.id && x.parent == mainCategory.id)

      if(userTickets.length >= 1) {
        if(message.type == "APPLICATION_COMMAND") {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else if(message.type == "MESSAGE_COMPONENT") {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    } else if(config.category.status == true && config.category.separateCategories == false) {
      let isChoosing = db.fetch(`choosingCategory_${member.id}`);
      if(isChoosing != null) {
        if(message.type == "APPLICATION_COMMAND") {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else if(message.type == "MESSAGE_COMPONENT") {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    }
    if(separatedPanel.status == true) {
      let ca = this.client.config.categories.find((cat) => cat.id.toLowerCase() == separatedPanel.cat_id.toLowerCase());
      if(!ca) {
        message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.invalid_panel, this.client.embeds.error_color)], ephemeral: true });
        return;
      }

      let createInCategory = this.client.config.category.separateCategories == true ? this.client.utils.findChannel(message.guild, ca.category) : mainCategory;
      let limit = ca.limit;

      let childrenTickets = db.fetch(`tickets_${member.id}`) || [];
      let separatePanelCategory = childrenTickets.filter((x) => x.parent == createInCategory.id);

      if(separatePanelCategory.length == limit) {
        message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.have_ticket_category, this.client.embeds.error_color)], ephemeral: true });
        return;
      }
    }
    const ticketId = parseInt(db.fetch(`ticketCount_${message.guild.id}`) + 1);
    message.guild.channels.create(this.client.utils.ticketPlaceholders(config.channels.channel_name, member.user, ticketId), {
        type: "GUILD_TEXT",
        parent: mainCategory,
        permissionOverwrites: [
          {
            id: this.client.user,
            allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_CHANNELS],
          },
          {
            id: member.user.id,
            allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES],
          },
          {
            id: everyone,
            deny: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES],
          }
        ],
      }).then(async (c) => {
        db.push(`tickets_${member.id}`, {
          member: member.id,
          channel: c.id,
          reason: reason || "N/A",
          parent: c.parentId
        });

        db.set(`ticketData_${c.id}`, {
          owner: member.user.id,
          openedAt: new Date(),
          openedTimestamp: message.createdTimestamp,
          id: ticketId
        });
        
        db.add(`ticketCount_${message.guild.id}`, 1);

        if(this.client.config.category.status == false) {
          c.permissionOverwrites.edit(member.user, {
            SEND_MESSAGES: true,
            VIEW_CHANNEL: true
          });
        } else {
          c.permissionOverwrites.edit(member.user, {
            SEND_MESSAGES: false,
            VIEW_CHANNEL: true
          });
        }

        c.setTopic(language.ticket.channel_topic.replace("<author>", member.user.username));
        if(config.roles.support.length > 0) {
          for(let i = 0; i < config.roles.support.length; i++) {
            let findRole = this.client.utils.findRole(message.guild, config.roles.support[i]);
            c.permissionOverwrites.create(findRole, {
                SEND_MESSAGES: true,
                VIEW_CHANNEL: true
            });
          }
        }
  
        const buttonRow = new MessageActionRow()
          .addComponents(
            new MessageButton()
              .setCustomId('closeTicket')
              .setLabel(this.client.language.buttons.close)
              .setEmoji(config.emojis.close)
              .setStyle('DANGER'),
            new MessageButton()
              .setCustomId('claimTicket')
              .setLabel(this.client.language.buttons.claim)
              .setEmoji(this.client.config.emojis.claim)
              .setStyle('SUCCESS')
          );

        if(config.category.questions == true && config.category.questions_type == "MODAL" && this.client.config.category.status == false && separatedPanel.status == false) {
          buttonRow.addComponents(
            new MessageButton()
              .setCustomId('ask_noCategory')
              .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
              .setEmoji(config.emojis.answer_questions)
              .setStyle('SUCCESS'),
          )
        }
        
  
        const jumpRow = new MessageActionRow()
          .addComponents(
            new MessageButton()
              .setURL(`https://discord.com/channels/${message.guild.id}/${c.id}`)
              .setLabel(this.client.language.buttons.go_ticket)
              .setStyle('LINK')
          );
  
        if(message.type == "APPLICATION_COMMAND") {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow], ephemeral: this.client.cmdConfig.new.ephemeral });
        } else if(message.type == "MESSAGE_COMPONENT") {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow], ephemeral: true });
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow] }).then(m => setTimeout(() => m.delete(), 5000)); 
        }
          
        if(config.general.mention_author == true) c.send(`<@${member.id}>`).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
        if(config.general.mention_support == true && config.roles.support.length > 0) {
          let supp = config.roles.support.map((r) => {
            let findSupport = this.client.utils.findRole(message.guild, r);
            
            if(findSupport) return findSupport;
          });
          
          c.send(supp.join(" ")).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
        }
        
        const embed = new MessageEmbed()
          .setColor(this.client.embeds.general_color)
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.embeds.ticket_message.replace("<user>", member)
            .replace("<reason>", `${reason}`));
            
        if(config.category.status == true) embed.setDescription(this.client.embeds.select_category);
        if(this.client.embeds.ticket.footer.enabled == true) embed.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
        if(this.client.embeds.ticket.image.enabled == true) embed.setImage(this.client.embeds.ticket.image.url);
        if(this.client.embeds.ticket.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.ticket.thumbnail.url);
        let msg = await c.send({ embeds: [embed], components: componentList(buttonRow) });

        if(config.category.questions == true && this.client.config.category.status == false && separatedPanel.status == false && config.category.questions_type == "MODAL") {
          startCollector(this.client, "noCategory", c, msg, member);
        } else if(config.category.questions == true && this.client.config.category.status == false && config.category.questions_type == "CHAT") {
          await chatAskQuestions(this.client, message.member, c, this.client.config.category.questionsList);
        }

        if(separatedPanel.status == true) {
          let ca = this.client.config.categories.find((cat) => cat.id.toLowerCase() == separatedPanel.cat_id.toLowerCase());
          if(!ca) {
            message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)], ephemeral: true });
            this.client.utils.sendError("Ticket Category with such ID " + ca.id + " couldn't be found (Separated Panels).");
            return;
          }

          if(ca.type == "COMMISSION") {
            db.set(`commission_${c.id}`, {
              user: member.id,
              commMessageId: null,
              data: [],
              quoteList: [],
              status: "NO_STATUS",
              date: new Date()
            });
          }

          let moveToCategory = this.client.utils.findChannel(message.guild, ca.category);
          if(this.client.config.category.separateCategories == true && ca.category != "" && moveToCategory) {
            let memberTicket = db.fetch(`tickets_${member.id}`);
            memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
            memberTicket.find((x) => x.channel == c.id).parent = moveToCategory.id;
            
            db.set(`tickets_${member.id}`, memberTicket);

            c.edit({ name: config.general.rename_choose == true && ca.channel_name != "" ? this.client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : null, 
              parent: moveCategory, lockPermissions: false }).then((ch) => {
              if(this.client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
                let editRole = ca.roles.map((x) => this.client.utils.findRole(message.guild, x));
                editRole = editRole.filter((r) => r != undefined);
            
                for(const r of editRole) {
                  c.permissionOverwrites.edit(r, {
                    SEND_MESSAGES: true,
                    VIEW_CHANNEL: true
                  }); 
                }
                if(config.roles.support.length > 0 && this.client.config.category.separateRoles.both == false) {
                  let suppEdit = config.roles.support.map((x) => this.client.utils.findRole(message.guild, x));
                  suppEdit = suppEdit.filter((r) => r != undefined); 
                  
                  for(const supp of suppEdit) {
                    c.permissionOverwrites.edit(supp, {
                      SEND_MESSAGES: false,
                      VIEW_CHANNEL: false
                    });
                  }
                }
              }
              ch.permissionOverwrites.edit(member.user, {
                SEND_MESSAGES: true,
                VIEW_CHANNEL: true
              });
            });
            embed.setTitle(ca.title);
            embed.setColor(ca.embed.color);
            embed.setDescription(ca.embed.description.replace("<user>", member)
              .replace("<reason>", `${reason}`)
              .replace("<category>", ca.name));
            msg.edit({ embeds: [embed], components: componentList(buttonRow) });
            
            if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
              buttonRow.addComponents(
                new MessageButton()
                  .setCustomId(`ask_${ca.id}`)
                  .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
                  .setEmoji(config.emojis.answer_questions)
                  .setStyle('SUCCESS'),
              );
              m.edit({ embeds: [m.embeds[0]], components: componentList(buttonRow) });
              startCollector(this.client, `${ca.id}`, c, msg, member);
              // await categoryCollector(this.client, member, ca, c);
            } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
              await chatAskQuestions(this.client, message.member, c, ca.questionsList, ca);
            }
          } else {
            let memberTicket = db.fetch(`tickets_${member.id}`);
            memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
            
            db.set(`tickets_${member.id}`, memberTicket);
            if(this.client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
              let editRole = ca.roles.map((x) => this.client.utils.findRole(message.guild, x));
              editRole = editRole.filter((r) => r != undefined);
              
              for(const r of editRole) {
                c.permissionOverwrites.edit(r, {
                  SEND_MESSAGES: true,
                  VIEW_CHANNEL: true
                }); 
              }
              if(config.roles.support.length > 0 && this.client.config.category.separateRoles.both == false) {
                let suppEdit = config.roles.support.map((x) => this.client.utils.findRole(message.guild, x));
                suppEdit = suppEdit.filter((r) => r != undefined); 
                
                for(const supp of suppEdit) {
                  c.permissionOverwrites.edit(supp, {
                    SEND_MESSAGES: false,
                    VIEW_CHANNEL: false
                  });
                }
              }
            }
            c.permissionOverwrites.edit(member.user, {
              SEND_MESSAGES: true,
              VIEW_CHANNEL: true
            });
            embed.setTitle(ca.title);
            embed.setColor(ca.embed.color);
            embed.setDescription(ca.embed.description.replace("<user>", member)
              .replace("<reason>", `${reason}`)
              .replace("<category>", ca.name));
            msg.edit({ embeds: [embed], components: componentList(buttonRow)});

            if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
              buttonRow.addComponents(
                new MessageButton()
                .setCustomId(`ask_${ca.id}`)
                .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
                .setEmoji(config.emojis.answer_questions)
                .setStyle('SUCCESS'),
              );
              
              msg.edit({ embeds: [embed], components: componentList(buttonRow)});
              startCollector(this.client, `${ca.id}`, c, msg, member);
              // await categoryCollector(this.client, member, ca, c);
            } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
              await chatAskQuestions(this.client, message.member, c, ca.questionsList, ca);
            }
          }
        }

        if(this.client.config.category.status == false || separatedPanel.status == true) return;
        db.set(`choosingCategory_${member.id}`, true);

        setTimeout(() => {
          db.delete(`choosingCategory_${member.id}`);
        }, 5 * 60000);

        const options = [];
        config.categories.forEach(c => {
          options.push({
            label: c.name,
            value: c.id, 
            emoji: c.emoji,
          });
        });
        
        let sMenu = new MessageSelectMenu()
          .setCustomId("categorySelect")
          .setPlaceholder(config.category.placeholder)
          .addOptions(options);
  
        let row = new MessageActionRow()
          .addComponents(sMenu);

        msg.edit({ embeds: [embed], components: componentList(buttonRow, row) });
        
        const filter = (interaction) => interaction.customId == "categorySelect" && interaction.user.id === member.id;
        const rCollector = msg.createMessageComponentCollector({ filter, componentType: "SELECT_MENU", time: this.client.config.general.no_select_delete * 1000 });
        
        let claimed = false;
        let haveTicket = false;
              
        rCollector.on("collect", async (i) => {
          await i.deferUpdate();
          let value = i.values[0];
          claimed = true;
          this.client.config.categories.forEach(async (ca) => {
            if(value == ca.id) {
              if(ca.type == "COMMISSION") {
                db.set(`commission_${c.id}`, {
                  user: member.id,
                  commMessageId: null,
                  data: [],
                  quoteList: [],
                  status: "NO_STATUS",
                  date: new Date()
                });
              }
              let moveCategory = this.client.utils.findChannel(message.guild, ca.category);
              if(config.category.separateCategories == true && ca.category != "" && moveCategory) {
                if(config.general.mention_support == true && ca.roles.length > 0 && config.category.separateRoles.both == false) {
                  let suppMention = ca.roles.map((r) => {
                    let caSupport = this.client.utils.findRole(message.guild, r);
                    
                    if(caSupport) return caSupport;
                  });
                  
                  if(suppMention.length > 0) c.send(suppMention.join(" ")).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
                }

                let childrenTickets = db.fetch(`tickets_${member.id}`) || [];
                let childrenArray = childrenTickets.filter((x) => x.parent == moveCategory.id);

                if(childrenArray.length < ca.limit) {
                  let memberTicket = db.fetch(`tickets_${member.id}`);
                  memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
                  memberTicket.find((x) => x.channel == c.id).parent = moveCategory.id;
                  db.set(`tickets_${member.id}`, memberTicket);

                  c.edit({ name: config.general.rename_choose == true && ca.channel_name != "" ? this.client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : null, 
                  parent: moveCategory, lockPermissions: false }).then((ch) => {
                    if(this.client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
                      let editRole = ca.roles.map((x) => this.client.utils.findRole(message.guild, x));
                      editRole = editRole.filter((r) => r != undefined);
                  
                      for(const r of editRole) {
                        c.permissionOverwrites.edit(r, {
                          SEND_MESSAGES: true,
                          VIEW_CHANNEL: true
                        }); 
                      }
                      if(config.roles.support.length > 0 && this.client.config.category.separateRoles.both == false) {
                        let suppEdit = config.roles.support.map((x) => this.client.utils.findRole(message.guild, x));
                        suppEdit = suppEdit.filter((r) => r != undefined); 
                        
                        for(const supp of suppEdit) {
                          c.permissionOverwrites.edit(supp, {
                            SEND_MESSAGES: false,
                            VIEW_CHANNEL: false
                          });
                        }
                      }
                    }
                    ch.permissionOverwrites.edit(member.user, {
                      SEND_MESSAGES: true,
                      VIEW_CHANNEL: true
                    });
                  });
                  embed.setTitle(ca.title);
                  embed.setColor(ca.embed.color);
                  embed.setDescription(ca.embed.description.replace("<user>", member)
                    .replace("<reason>", `${reason}`)
                    .replace("<category>", ca.name));
                  msg.edit({ embeds: [embed], components: componentList(buttonRow)});
                  haveTicket = false;

                  if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
                    buttonRow.addComponents(
                      new MessageButton()
                        .setCustomId(`ask_${ca.id}`)
                        .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
                        .setEmoji(config.emojis.answer_questions)
                        .setStyle('SUCCESS'));
                    
                    msg.edit({ embeds: [embed], components: componentList(buttonRow) });
                    
                    startCollector(this.client, `${ca.id}`, c, msg, member);
                    // await categoryCollector(this.client, member, ca, c);
                  } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
                    await chatAskQuestions(this.client, message.member, c, ca.questionsList, ca);
                  }
                } else {
                  msg.edit({ embeds: [embed], components: componentList(buttonRow, row)});
                  haveTicket = true;
                }
              } else {
                if(config.general.mention_support == true && ca.roles.length > 0 && config.category.separateRoles.both == false) {
                  let suppMention = ca.roles.map((r) => {
                    let caSupport = this.client.utils.findRole(message.guild, r);
                    
                    if(caSupport) return caSupport;
                  });
                  
                  if(suppMention.length > 0) c.send(suppMention.join(" ")).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
                }
                
                let memberTickets = db.fetch(`tickets_${member.id}`);
                let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

                if(listOfTickets.length < ca.limit) {
                  let memberTicket = db.fetch(`tickets_${member.id}`);
                  memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
                  db.set(`tickets_${member.id}`, memberTicket);

                  if(this.client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
                    let editRole = ca.roles.map((x) => this.client.utils.findRole(message.guild, x));
                    editRole = editRole.filter((r) => r != undefined);
                    
                    for(const r of editRole) {
                      c.permissionOverwrites.edit(r, {
                        SEND_MESSAGES: true,
                        VIEW_CHANNEL: true
                      }); 
                    }
                    if(config.roles.support.length > 0 && this.client.config.category.separateRoles.both == false) {
                      let suppEdit = config.roles.support.map((x) => this.client.utils.findRole(message.guild, x));
                      suppEdit = suppEdit.filter((r) => r != undefined); 
                      
                      for(const supp of suppEdit) {
                        c.permissionOverwrites.edit(supp, {
                          SEND_MESSAGES: false,
                          VIEW_CHANNEL: false
                        });
                      }
                    }
                  }
                  c.permissionOverwrites.edit(member.user, {
                    SEND_MESSAGES: true,
                    VIEW_CHANNEL: true
                  });
                  embed.setTitle(ca.title);
                  embed.setColor(ca.embed.color);
                  embed.setDescription(ca.embed.description.replace("<user>", member)
                    .replace("<reason>", `${reason}`)
                    .replace("<category>", ca.name));
                  msg.edit({ embeds: [embed], components: componentList(buttonRow)});
                  haveTicket = false;
                  db.delete(`choosingCategory_${member.id}`);
                  db.set(`ticketCategory_${c.id}`, {
                    user: member.id,
                    category: `${ca.category}`
                  });

                  if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
                    buttonRow.addComponents(
                      new MessageButton()
                      .setCustomId(`ask_${ca.id}`)
                      .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
                      .setEmoji(config.emojis.answer_questions)
                      .setStyle('SUCCESS'));
                      
                    msg.edit({ embeds: [embed], components: componentList(buttonRow) });
                    
                    startCollector(this.client, `${ca.id}`, c, msg, member);
                    // await categoryCollector(this.client, member, ca, c);
                  } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
                    await chatAskQuestions(this.client, message.member, c, ca.questionsList, ca);
                  }
                } else {
                  msg.edit({ embeds: [embed], components: componentList(buttonRow, row)});
                  haveTicket = true;
                }
              }
            }
          });
          if(haveTicket == true) c.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.have_ticket_category, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000))
          if(haveTicket == false) rCollector.stop();
        });
        
        rCollector.on("end", (collected, reason) => {
          if(claimed == true) return;
          if(reason != "time") return;
          db.delete(`ticketCategory_${c.id}`);
          db.delete(`choosingCategory_${member.id}`);

          c.delete();
        });
      }).catch(console.error);
  }
};

const startCollector = (client, category, channel, msg, member) => {
  if(client.config.category.lock_ticket == true) {
    channel.permissionOverwrites.edit(member.user, {
      SEND_MESSAGES: false,
      VIEW_CHANNEL: true
    });
  }

  const questFilter = (btn) => btn.customId == `ask_${category}` && btn.user.id == member.id;
  channel.awaitMessageComponent({ questFilter, componentType: "BUTTON", time: client.config.general.question_idle * 1000 })
    .then(interaction => {})
    .catch(() => {
      msg.components[0].components.forEach((c) => {
        if(c.customId != "closeTicket" && c.customId != "claimTicket") c.setDisabled(true);
      });

      msg.edit({ embeds: [msg.embeds[0]], components: [msg.components[0]] }).catch((err) => { });
  })
}