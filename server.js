require('dotenv').config();
const express = require("express");
const fs = require("fs");
const DiscordOauth2 = require("discord-oauth2");
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

/**
 * Reads a html view file and returns the content as a string
 *
 * @param {*} name Name of view
 * @returns
 */
function readViewFile(name, layoutView = false) {
  let content = fs.readFileSync(__dirname + `/views/${name}.html`).toString()
  if (!layoutView)
    content = insertValues(layout, { CONTENT: content }, false);
  return content;
}

/**
 * Inserts values into a string
 *
 * @param {*} base Base string
 * @param {*} values Values ({ [name: string]: value })
 * @param {boolean} [addDefault=true] If the default values should be inserted
 * @returns
 */
function insertValues(base, values, addDefault = true) {
  for (const [key, value] of Object.entries(values))
    base = base.split(`{{${key.toLocaleUpperCase()}}}`).join(value);
  if (addDefault)
    return insertValues(base, {
      CHECK_NAME: checkpointConfig.name,
      CHECK_MESSAGE: checkpointConfig.message,
      CHECK_LINK: checkpointConfig.link
    }, false);
  return base;
}

/**
 * Logs that a user has passed and also checks if the passing is valid
 *
 * @param {*} user Id of user that passed
 * @param {*} timestamp When the user passed
 * @returns Error message if there is a problem
 */
async function logUserPassing(userId, timestamp) {
  try {
    let user = await UserModel.findOne({ id: userId });
    if (process.env.CHECKPOINT_ID == 0) {
      if (user) return;
      new UserModel({
        id: userId,
        checkpoints: [timestamp]
      }).save();
      return;
    }

    if (!user || !user.checkpoints[process.env.CHECKPOINT_ID - 1])
      return 'You haven\'t even been at the last checkpoint.';
    let lastCheckpoint = user.checkpoints[process.env.CHECKPOINT_ID - 1];
    if (lastCheckpoint + checkpointConfig.minTime > timestamp) {
      return `You've reached this checkpoint too fast.\nTry again in ${lastCheckpoint + checkpointConfig.minTime - timestamp} milliseconds.`;
    }

    if (user.checkpoints[process.env.CHECKPOINT_ID]) return;
    user.checkpoints[process.env.CHECKPOINT_ID] = timestamp;
    user.markModified('checkpoints');
    user.save();
  } catch (err) {
    console.error(err.stack);
    return `Server was unable to verify validity of this passing.\n${defaultErrorMessage}`;
  }
}

const defaultErrorMessage = 'Please contact the staff on the CodeBullet Discord server.';

const layout = readViewFile('layout', true);

const content = {
  index: undefined,
  error: readViewFile('error'),
  result: readViewFile('result')
}

const oauth = new DiscordOauth2({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

let checkpointConfig = undefined;

const app = express();
app.use(express.static("public"));
app.get("/", asyncHandler(async (req, res, next) => {
  if (!req.query.code)
    return res.send(content.index);

  let result = undefined;
  try {
    result = await oauth.tokenRequest({
      code: req.query.code,
      grantType: "authorization_code",
      scope: ['identify']
    });
  } catch{
    return next(new Error('The access code seems to be incorrect.'));
  }

  let user = undefined;
  try {
    user = await oauth.getUser(result.access_token);
  } catch (err) {
    console.error(err.stack);
    return next(new Error(`The server was unable to retrieve the user info from Discord.\n${defaultErrorMessage}`));
  }

  let potentialError = await logUserPassing(user.id, Date.now());
  if (potentialError)
    throw new Error(potentialError);

  return res.send(insertValues(content.result, {
    USER_NAME: user.username,
    USER_DISC: user.discriminator,
    USER_ID: user.id,
    USER_AVATAR: user.avatar
  }));
}));
app.use(function (err, req, res, next) {
  if (!err.message) console.error(err.stack);
  res.send(insertValues(content.error, { REASON: err.message || defaultErrorMessage }));
});

const CheckpointModel = mongoose.model('checkpoint', {
  id: Number,
  name: String,
  message: String,
  link: { default: "#", type: String },
  minTime: { required: false, type: Number }
}, 'checkpoints');

const UserModel = mongoose.model('user', {
  id: String,
  checkpoints: [Number]
}, 'users');

/**
 * Main function to add async await support
 *
 */
async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Successfully connected to MongoDB');

  checkpointConfig = await CheckpointModel.findOne({ id: process.env.CHECKPOINT_ID });
  if (!checkpointConfig)
    throw new Error(`No config was found for checkpoint ${process.env.CHECKPOINT_ID}`);

  content.index = insertValues(readViewFile('index'), {
    CLIENT_ID: process.env.CLIENT_ID,
    REDIRECT_URI: encodeURIComponent(process.env.REDIRECT_URI)
  });

  const listener = app.listen(process.env.PORT, () => {
    console.log(`Node for checkpoint ${process.env.CHECKPOINT_ID} listening on port ${process.env.PORT}`);
  });
}

main();
