import * as Discord from 'discord.js';
import * as logger from 'winston';
import * as dotenv from 'dotenv';
import * as steem from 'steem';
import * as http from 'http';

import 'babel-polyfill';

dotenv.config();

// ============================================================
// Database
// ============================================================
import db from './db';
db();

// ============================================================
// Controller
// ============================================================
import {
  checkRegisteredUser,
  checkLastPost,
  updateTime
} from './controller/user';

import {
  upvotePost,
  commentPost
} from './controller/upvote';

import config from './config.json';
import regex from './regex.json';

// ============================================================
// Start Discord
// ============================================================
const client = new Discord.Client();

// ============================================================
// Discord Ready connected
// ============================================================
client.on('ready', () => {
  logger.info(`Logged in as ${client.user.tag}!`);
});

// ============================================================
// Discord Receive Message
// ============================================================

client.on('message', msg => {
  // **************************************************
  // Restricted Channel
  // **************************************************
  if (msg.channel.id !== config.channelId) {
    return;
  } else {
    // **************************************************
    // Get information about the message
    // **************************************************

    let {
      id: currentMessageId,
      author: {
        username: currentUsername,
        id: currentUserId
      },
      content: currentContent,
      createdTimestamp: currentCreatedTimestamp
    } = msg;

    logger.info(currentContent);

    // **************************************************
    // Check for trigger
    // **************************************************

    if (currentContent.substring(0, 1) == config.trigger) {
      let args = msg.content.substring(1).split(' ');
      const cmd = args[0];
      args = args.splice(1);
      switch (cmd) {
        case 'upvote':
          if (args.length === 1) {
            let authorName = args[0].split(/[\/#]/)[4];
            let permlinkName = args[0].split(/[\/#]/)[5];
            if (
              authorName.charAt(0) === '@' &&
              !!permlinkName
            ) {
              upvotePost(
                process.env.STEEM_POSTING,
                process.env.STEEM_USERNAME,
                authorName.substr(1),
                permlinkName,
                500
              )
                .then(data => {
                  if (data === 'ERROR') {
                    throw 'NO_UPVOTE';
                  } else {
                    msg.reply(`Upvoted`);
                    return;
                  }
                })
                .then(() => {
                  return commentPost(
                    process.env.STEEM_POSTING,
                    process.env.STEEM_USERNAME,
                    authorName.substr(1),
                    permlinkName
                  ).catch(() => {
                    msg.reply('Unable to comment');
                  });
                })
                .catch(() => {
                  msg.reply(
                    'The post cannot be upvoted. It might be upvoted already.'
                  );
                });
              break;
            } else {
              msg.reply('Invalid link');
            }
          } else {
            msg.reply(
              `Wrong format, please use \`${
                config.trigger
              }upvote\ <steemit link>\``
            );
          }
          break;
        case 'help':
          msg.reply(`
            \`${
              config.trigger
            }upvote\ <steemit link>\` to get your post upvoted.
            \`${
              config.trigger
            }help\` to get help on getting started`);
          break;
        default:
          msg.reply(
            `Type \`${config.trigger}help\` to get started`
          );
          break;
      }
    }
  }
}); // Start Discord Server // ============================================================

// ============================================================
client.login(process.env.DISCORD_TOKEN); // Start server
