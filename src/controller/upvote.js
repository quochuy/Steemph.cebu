import steem from 'steem';

function upvotePost(
  steem_posting_key,
  steem_username,
  author,
  permlink,
  weightage
) {
  return new Promise(function(resolve, reject) {
    steem.broadcast.vote(
      steem_posting_key,
      steem_username,
      author,
      permlink,
      weightage,
      function(err, result) {
        if (err) {
          reject('ERROR');
        } else if (!result) {
          reject('ERROR');
        } else if (!!result.id && !!result.block_num) {
          resolve(result);
        } else {
          reject('ERROR');
        }
      }
    );
  }).catch(err => 'ERROR');
}

function commentPost(
  steem_posting_key,
  steem_username,
  author,
  permlink
) {
  steem.broadcast
    .comment(
      steem_posting_key, // posting wif
      author, // author, leave blank for new post
      permlink, // first tag or permlink
      steem_username, // username
      permlink, // permlink
      '', // Title
      `um... please don't mind me, I am just testing this out. I am not spamming, really. I'll be on my way now. oh yes... I just upvoted you by the way. Stephard Tester, superoo7/superoo7-dev`, // Body of post
      {
        tags: ['teammalaysiadevtest', 'teammalaysia'],
        app: 'stephard/0.1'
      }, // json metadata (additional tags, app name, etc)
      function(err, result) {
        if (err) {
          console.log(err);
          throw 'err';
        }
        console.log(result);
      }
    )
    .catch(err => 'ERROR');
}

export { upvotePost, commentPost };
