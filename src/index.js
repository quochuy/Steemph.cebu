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
  commentPost,
  findPost
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
  // Return Bot User
  // **************************************************
  if (msg.author.bot) return;
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

    // setup function
    const redMsg = (reply) => {
      return msg.reply({
        embed: {
          color: 0xff0000,
          description: reply
        }
      })
    }

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
                .then(async () => {
                  console.log('find post')
                  return await findPost(authorName.substr(1), permlinkName).catch(err => {
                    throw err.message
                  })
                })
                .then(() => {
                  console.log('upvote post')
                  // **************************************************
                  // Upvote Post
                  // **************************************************
                  return upvotePost(
                      process.env.STEEM_POSTING,
                      process.env.STEEM_USERNAME,
                      authorName.substr(1),
                      permlinkName,
                      config.weightage
                    )
                    .then(data => {
                      if (data === 'ERROR') {
                        throw 'NO_UPVOTE';
                      } else {
                        msg.reply(`This post is successfully upvoted by ${client.user.tag} : ${
                          args[0]
                        }.

You are now in voting cooldown. ${config.timeAllowed /
                          60 /
                          60} hours left before you can request for an upvote.`);
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
                        )
                        .then(() =>
                          console.log(`data updated`)
                        )
                        .catch(() => {
                          throw 'DB_ERROR';
                        });
                    })
                  // .then(() => {
                  //   // **************************************************
                  //   // Comment on  Post
                  //   // **************************************************
                  //   return commentPost(
                  //     process.env.STEEM_POSTING,
                  //     process.env.STEEM_USERNAME,
                  //     authorName.substr(1),
                  //     permlinkName
                  //   );
                  // });
                })
                .catch(err => {

                  switch (err) {
                    case 'NO_UPVOTE':
                      redMsg(
                        'I cannot upvote this post. I might already upvoted this post or the link is invalid. Be reminded that for me to vote : \n `$upvote <steemit_link>` \n e.g. `$upvote https://steemit.com/blabla/@bla/bla`'
                      );
                      break;
                    case 'NOT_YET_TIME':
                      redMsg(
                        `I had already voted on one of your post. Please wait for
 ${timeConvertMessage(
   convert(config.timeAllowed - timeDiff)
 )}.`
                      );
                      break;
                    case 'DB_ERROR':
                      redMsg('Database Error');
                      break;
                    case 'NO_COMMENT':
                      redMsg('No comment');
                      break;
                    case 'OLD':
                      redMsg('Post too old to get upvoted.');
                      break;
                    case 'NEW':
                      redMsg('Post too new to get upvoted.');
                      break;
                    case 'VOTED':
                      redMsg('Post already been voted');
                      break;
                    case 'CHEETAH':
                      redMsg('Post voted by cheetah');
                      break;
                    default:
                      redMsg(JSON.stringify(err));
                      break;
                  }
                });

              break;
            } else {
              redMsg('Invalid link');
            }
          } else {
            redMsg(
              'I cannot upvote this post. I might already upvoted this post or the link is invalid. Be reminded that for me to vote : \n `$upvote <steemit_link>` \n e.g. `$upvote https://steemit.com/blabla/@bla/bla`');
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