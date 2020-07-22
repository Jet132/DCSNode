require('dotenv').config();
const express = require("express");
const fs = require("fs");
const DiscordOauth2 = require("discord-oauth2");
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

function readViewFile(name) {
  return fs.readFileSync(__dirname + `/views/${name}.html`).toString();
}

function insertValues(base, values, noDefault = false) {
  for (const [key, value] of Object.entries(values))
    base = base.split(`{{${key.toLocaleUpperCase()}}}`).join(value);
  if (!noDefault)
    return insertValues(base, {
      CHECK_NAME: checkpointConfig.name,
      CHECK_MESSAGE: checkpointConfig.message
    }, true);
  return base;
}

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

app.get("/", asyncHandler(async (req, res) => {
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
    return res.send(insertValues(content.error, { REASON: 'The access code seems to be incorrect.' }));
  }

  let user = undefined;
  try {
    user = await oauth.getUser(result.access_token);
  } catch{
    return res.send(insertValues(content.error, { REASON: 'The server was unable to retrieve the user info from Discord.' }));
  }

  return res.send(insertValues(content.result, {
    USER_NAME: user.username,
    USER_DISC: user.discriminator,
    USER_ID: user.id,
    USER_AVATAR: user.avatar
  }));
}));

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

const checkpointConfigSchema = mongoose.model('config', {
  id: Number,
  name: String,
  message: String,
  minTime: { required: false, type: Number }
}, 'checkpoints');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Successfully connected to MongoDB');

  checkpointConfig = await checkpointConfigSchema.findOne({ id: process.env.CHECKPOINT_ID });
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
