require('dotenv').config();
const express = require("express");
const fs = require("fs");
const DiscordOauth2 = require("discord-oauth2");
const asyncHandler = require('express-async-handler');

function readViewFile(name) {
  return fs.readFileSync(__dirname + `/views/${name}.html`).toString();
}

function insertValues(base, values) {
  for (const [key, value] of Object.entries(values))
    base = base.replace(`{{${key.toLocaleUpperCase()}}}`, value);
  return base;
}

const indexContent = insertValues(readViewFile('index'), {
  CLIENT_ID: process.env.CLIENT_ID,
  REDIRECT_URI: encodeURIComponent(process.env.REDIRECT_URI)
});
const errorContent = readViewFile('error');
const resultContent = readViewFile('result');

const oauth = new DiscordOauth2({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

const app = express();

app.use(express.static("public"));

app.get("/", asyncHandler(async (req, res) => {
  if (!req.query.code)
    return res.send(indexContent);

  let result = undefined;
  try {
    result = await oauth.tokenRequest({
      code: req.query.code,
      grantType: "authorization_code",
      scope: ['identify']
    });
  } catch{
    return res.send(errorContent.replace('{{REASON}}', 'The access code seems to be incorrect.'));
  }

  let user = undefined;
  try {
    user = await oauth.getUser(result.access_token);
  } catch{
    return res.send(errorContent.replace('{{REASON}}', 'The server was unable to retrieve the user info from Discord.'));
  }

  return res.send(insertValues(resultContent, {
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

const listener = app.listen(process.env.PORT, () => {
  console.log(`Node ${process.env.NODE_ID} listening on port ${process.env.PORT}`);
});
