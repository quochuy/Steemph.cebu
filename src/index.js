import * as Discord from 'discord.js';
import * as logger from 'winston';
import * as dotenv from 'dotenv';
import * as steem from 'steem';
import * as http from 'http';
import convert from 'convert-seconds';

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
  updateTime,
  registration
} from './controller/user';
import {
  upvotePost,
  commentPost
} from './controller/upvote';

import {
  getDateTimeFromTimestamp,
  timeConvertMessage
} from './controller/util';

import config from './config.json';
import regex from './regex.json';

// ============================================================
// Start Discord
// ============================================================
let timeDiff;
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
          if (
            args.length === 1 &&
            args[0].split(/[\/#]/).length === 6
          ) {
            let authorName = args[0].split(/[\/#]/)[4];
            let permlinkName = args[0].split(/[\/#]/)[5];
            if (
              authorName.charAt(0) === '@' &&
              !!permlinkName
            ) {
              // **************************************************
              // Check registered user
              // **************************************************
              checkRegisteredUser(currentUserId)
                .then(isRegistered => {
                  console.log(isRegistered);
                  if (isRegistered) {
                    // **************************************************
                    // Check date time
                    // **************************************************
                    return checkLastPost(
                      currentUserId
                    ).then(data => {
                      if (!!data) {
                        timeDiff = Math.floor(
                          (currentCreatedTimestamp - data) /
                            1000
                        );
                        if (timeDiff > config.timeAllowed) {
                          // Proceed
                        } else {
                          throw 'NOT_YET_TIME';
                          return;
                        }
                      }
                    });

                    console.log('registered');
                  } else {
                    console.log('not registered');
                    // **************************************************
                    // Register user
                    // **************************************************
                    return registration(
                      currentUsername,
                      currentUserId
                    )
                      .then(data => {
                        console.log(data);
                        if (data === 'DB_ERROR') {
                          throw data;
                        }
                      })
                      .catch(err => err);
                  }
                })
                .then(() => {
                  // **************************************************
                  // Upvote Post
                  // **************************************************
                  return upvotePost(
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
                      // **************************************************
                      // Update Date Time of the Post
                      // **************************************************
                      return updateTime(
                        currentUserId,
                        currentCreatedTimestamp
                      );
                    })
                    .then(() => {
                      // **************************************************
                      // Comment on  Post
                      // **************************************************
                      return commentPost(
                        process.env.STEEM_POSTING,
                        process.env.STEEM_USERNAME,
                        authorName.substr(1),
                        permlinkName
                      ).catch(() => {
                        msg.reply('Unable to comment');
                      });
                    })
                    .catch();
                })
                .catch(err => {
                  switch (err) {
                    case 'NO_UPVOTE':
                      msg.reply(
                        'The post cannot be upvoted. It might be upvoted already or the link is invalid.'
                      );
                      break;
                    case 'NOT_YET_TIME':
                      msg.reply(
                        `Please wait for ${timeConvertMessage(
                          convert(
                            config.timeAllowed - timeDiff
                          )
                        )}`
                      );
                      break;
                    case 'DB_ERROR':
                      msg.reply('Database Error');
                      break;
                    default:
                      msg.reply('ERROR');
                      break;
                  }
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
