# Discord Checkpoint System Node

A small server that represents a checkpoint.

## Usage

First create a `.env` file in the project root

```conf
CLIENT_ID=[Discord client id]
CLIENT_SECRET=[Discord client secret]
CHECKPOINT_ID=[Checkpoint id]
REDIRECT_URI=[Redirect uri (normally url to this checkpoint)]
PORT=[Port to have to web server listen to]
MONGO_URI=[Connection uri for MongoDB server]
```

Install all packages

```shell
npm install
```

Run Server

```shell
npm start
```
