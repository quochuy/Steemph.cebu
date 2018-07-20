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
  findPost,
  getSteemPower,
  getDelegateSP
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
    const redMsg = reply => {
      return msg.reply({
        embed: {
          color: 0xff0000,
          description: reply
        }
      });
    };
    const greenMsg = reply => {
      return msg.reply({
        embed: {
          color: 0x00f900,
          description: reply
        }
      });
    };
    // **************************************************
    // Check for trigger
    // **************************************************

    if (currentContent.substring(0, 1) == config.trigger) {
      let args = msg.content.substring(1).split(' ');
      const cmd = args[0];
      args = args.splice(1);
      switch (cmd) {
        case 'upvote':
          if (!!msg.member.roles.find('name', 'Admins')) {
            // TODO: ADD ADMIN
            if (args.length !== 3) {
              redMsg('Invalid command, try use `$upvote link weightage`');
              return;
            }
            let authorName = args[1].split(/[\/#]/)[4].substr(1);
            let permlinkName = args[1].split(/[\/#]/)[5];
            let weightage = parseInt(args[2]);
            return upvotePost(
                process.env.STEEM_POSTING,
                process.env.STEEM_USERNAME,
                authorName.substr(1),
                permlinkName,
                weightage * 100
              )
              .then(() => {
                greenMsg('Sucess');
              })
              .catch(() => {
                redMsg('Failed');
              });
          } else if (args.length === 1 && args[0].split(/[\/#]/).length === 6) {
            let authorName = args[0].split(/[\/#]/)[4];
            let permlinkName = args[0].split(/[\/#]/)[5];
            if (authorName.charAt(0) === '@' && !!permlinkName) {
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
                    return checkLastPost(currentUserId).then(data => {
                      if (!!data) {
                        timeDiff = Math.floor((currentCreatedTimestamp - data) / 1000);
                        if (timeDiff > config.timeAllowed) {
                          // Proceed
                        } else {
                          throw 'NOT_YET_TIME';
                          return;
                        }
                      }
                    });
                  } else {
                    console.log('not registered');
                    // **************************************************
                    // Register user
                    // **************************************************
                    return registration(currentUsername, currentUserId).then(data => {
                      console.log(data);
                      if (data === 'DB_ERROR') {
                        throw data;
                      }
                    });
                  }
                })
                .then(async () => {
                  console.log('find post');
                  return await findPost(authorName.substr(1), permlinkName).catch(err => {
                    throw err.message;
                  });
                })
                .then(async () => {
                  console.log('upvote post');
                  // **************************************************
                  // Upvote Post
                  // **************************************************
                  let weightage = 0;

                  if (!!msg.member.roles.find('name', 'trail-follower')) {
                    // if a person has the role of 'trail-follower'
                    const temp = await getSteemPower(authorName.substr(1)).catch(err => {
                      throw err;
                    });
                    const sp = Math.round(temp);
                    switch (true) {
                      case sp > 190: // 191-200=50%
                        weightage = 50 * 100;
                        break;
                      case sp > 180: // 181-190=48%
                        weightage = 48 * 100;
                        break;
                      case sp > 170: // 171-180=46%
                        weightage = 46 * 100;
                        break;
                      case sp > 160: // 161-170=44%
                        weightage = 44 * 100;
                        break;
                      case sp > 150: // 151-160=42%
                        weightage = 42 * 100;
                        break;
                      case sp > 140: // 141-150=40%
                        weightage = 40 * 100;
                        break;
                      case sp > 130: // 131-140=38%
                        weightage = 38 * 100;
                        break;
                      case sp > 120: // 121-130=36%
                        weightage = 36 * 100;
                        break;
                      case sp > 110: // 111-120=34%
                        weightage = 34 * 100;
                        break;
                      case sp > 100: // 101-110=32%
                        weightage = 32 * 100;
                        break;
                      case sp > 90: // 91-100=30%
                        weightage = 30 * 100;
                        break;
                      case sp > 80: // 81-90=28%
                        weightage = 28 * 100;
                        break;
                      case sp > 70: // 71-80=26%
                        weightage = 26 * 100;
                        break;
                      case sp > 60: // 61-70=24%
                        weightage = 24 * 100;
                        break;
                      case sp > 50: // 51-60=22%
                        weightage = 22 * 100;
                        break;
                      case sp > 40: // 41-50=20%
                        weightage = 20 * 100;
                        break;
                      case sp > 30: // 31-40=18%
                        weightage = 18 * 100;
                        break;
                      case sp > 20: // 21-30=16%
                        weightage = 16 * 100;
                        break;
                      case sp > 10: // 11-20=14%
                        weightage = 14 * 100;
                        break;
                      case sp > 1: // 1-10=12%
                        weightage = 12 * 100;
                        break;
                      default:
                        console.log('SP too low');
                        throw 'SP too low';
                    }
                    weightage = weightage / 2;
                    greenMsg(`Role: trail-follower, SP: ${sp}, upvote %: ${weightage / 100}`);
                  }
                  if (!!msg.member.roles.find('name', 'Delegatee')) {
                    // if a person is a delegator
                    const temp = await getDelegateSP(authorName.substr(1), process.env.STEEM_USERNAME).catch(err => {
                      throw err;
                    });
                    const sp = Math.round(temp);
                    switch (true) {
                      case sp > 190: // 191-200=50%
                        weightage += 50 * 100;
                        break;
                      case sp > 180: // 181-190=48%
                        weightage += 48 * 100;
                        break;
                      case sp > 170: // 171-180=46%
                        weightage += 46 * 100;
                        break;
                      case sp > 160: // 161-170=44%
                        weightage += 44 * 100;
                        break;
                      case sp > 150: // 151-160=42%
                        weightage += 42 * 100;
                        break;
                      case sp > 140: // 141-150=40%
                        weightage += 40 * 100;
                        break;
                      case sp > 130: // 131-140=38%
                        weightage += 38 * 100;
                        break;
                      case sp > 120: // 121-130=36%
                        weightage = 36 * 100;
                        break;
                      case sp > 110: // 111-120=34%
                        weightage += 34 * 100;
                        break;
                      case sp > 100: // 101-110=32%
                        weightage += 32 * 100;
                        break;
                      case sp > 90: // 91-100=30%
                        weightage += 30 * 100;
                        break;
                      case sp > 80: // 81-90=28%
                        weightage += 28 * 100;
                        break;
                      case sp > 70: // 71-80=26%
                        weightage += 26 * 100;
                        break;
                      case sp > 60: // 61-70=24%
                        weightage += 24 * 100;
                        break;
                      case sp > 50: // 51-60=22%
                        weightage += 22 * 100;
                        break;
                      case sp > 40: // 41-50=20%
                        weightage += 20 * 100;
                        break;
                      case sp > 30: // 31-40=18%
                        weightage += 18 * 100;
                        break;
                      case sp > 20: // 21-30=16%
                        weightage += 16 * 100;
                        break;
                      case sp > 10: // 11-20=14%
                        weightage += 14 * 100;
                        break;
                      case sp > 1: // 1-10=12%
                        weightage += 12 * 100;
                        break;
                      default:
                        console.log('no delegation');
                        throw 'NO_DELEGATE';
                    }
                    greenMsg(`Role: delegator, delegated SP: ${sp}, upvote %: ${weightage / 100}`);
                  }

                  if (weightage === 0) {
                    throw 'NO_DELEGATE';
                  }

                  return upvotePost(
                      process.env.STEEM_POSTING,
                      process.env.STEEM_USERNAME,
                      authorName.substr(1),
                      permlinkName,
                      weightage
                    )
                    .then(data => {
                      if (data === 'ERROR') {
                        throw 'NO_UPVOTE';
                      } else {
                        msg.reply(`This post is successfully upvoted by ${client.user.tag} : ${args[0]}.
You are now in voting cooldown. ${config.timeAllowed / 60 / 60} hours left before you can request for an upvote.`);
                        return;
                      }
                    })
                    .then(() => {
                      // **************************************************
                      // Update Date Time of the Post
                      // **************************************************
                      return updateTime(currentUserId, currentCreatedTimestamp)
                        .then(() => console.log(`data updated`))
                        .catch(() => {
                          throw 'DB_ERROR';
                        });
                    });
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
                  console.log(err);
                  switch (err) {
                    case 'NO_DELEGATE':
                      redMsg(
                        'You had not yet delegate to the bot. Please contact moderator if you think it is an error.'
                      );
                      break;
                    case 'NO_UPVOTE':
                      redMsg(
                        'I cannot upvote this post. I might already upvoted this post or the link is invalid. Be reminded that for me to vote : \n `$upvote <steemit_link>` \n e.g. `$upvote https://steemit.com/blabla/@bla/bla`'
                      );
                      break;
                    case 'NOT_YET_TIME':
                      redMsg(
                        `I had already voted on one of your post. Please wait for
 ${timeConvertMessage(convert(config.timeAllowed - timeDiff))}.`
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
              'I cannot upvote this post. I might already upvoted this post or the link is invalid. Be reminded that for me to vote : \n `$upvote <steemit_link>` \n e.g. `$upvote https://steemit.com/blabla/@bla/bla`'
            );
          }
          break;
        case 'help':
          msg.reply(`
            \`${config.trigger}upvote\ <steemit link>\` to get your post upvoted.
            \`${config.trigger}help\` to get help on getting started`);
          break;
        default:
          msg.reply(`Type \`${config.trigger}help\` to get started`);
          break;
      }
    }
  }
}); // Start Discord Server // ============================================================

// ============================================================
client.login(process.env.DISCORD_TOKEN); // Start server