const express = require('express');
const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const app = express();

const DBConnectionString = `mongodb://${process.env.USER_NAME}:${process.env.USER_PWD}@${process.env.DB_URL}`
const mongoClientOptions = {useNewUrlParser: true, useUnifiedTopology: true};

require('dotenv').config();

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")))

app.get('/get-profile', async (req, res) => {
    let response = {};
    await MongoClient.connect(DBConnectionString, mongoClientOptions, (err, client) => {
        if (err) throw err;
        let db = client.db(process.env.DB_NAME);
        let myquery = {userid: 1};

        db.collection("users").findOne(myquery,  (err, result) => {
            if (err) throw err;
            response = result;
            client.close();
            res.send(response ? response : {});
        });
    });
});

app.post('/update-profile', async (req, res) => {
    let userObj = req.body;
    await MongoClient.connect(DBConnectionString, mongoClientOptions, (err, client) => {
        if (err) throw err;
        let db = client.db(process.env.DB_NAME);
        let myquery = {userid: 1};
        userObj['userid'] = 1;
        let newValues = {$set: userObj};
        db.collection("users").updateOne(myquery, newValues, {upsert: true}, (err) => {
            if (err) throw err;
            client.close();
        });
    });
    res.send(userObj);
});

app.listen(3000, () => {
    console.log("app listening on port 3000!");
});
