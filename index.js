const express = require('express');
const axios = require('axios');
const config = require('./config')
const mysql = require('mysql');
const { Client } = require('pg')

const app = express();
const port = 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});


const connectionString = 'postgresql://jamesshields@localhost:5433/jamesshields';

const client = new Client({
  connectionString: connectionString
});

client.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ', err);
    return;
  }
  console.log('Connected to the database');
});

app.get('/lessons/get_topics', (req, res) => {

  // Request data
  console.log('req.query.userInput', req.query.userInput)

  // Meta data
  const userAgent = req.headers['user-agent'];
  const deviceType = req.headers['x-device-type'];
  const language = req.headers['accept-language'];
  console.log('userAgent', userAgent)
  console.log('deviceType', deviceType)
  console.log('language', language)

  axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: "gpt-3.5-turbo",
      messages: [{ "role": "user", "content": `you are a teaching ai bot, what are the five main topics about ${req.query.userInput}? just give me the topic title/heading. Do not number the bullet points.` }],
      temperature: 0.7
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
    }
  )
    .then((response) => {
      const reply = response.data.choices[0].message.content;
      const replyForm = reply.split("\n").map((str) => str.substring(2))
      for (let i = 0; i < replyForm.length; i++) {
        if (replyForm[i].charAt(0) === " ") {
          replyForm[i] = replyForm[i].substring(1);
        }
      }
      res.send({
        "success": true,
        "data": {
          "topics": replyForm
        }
      })

      const subjectIn = req.query.userInput;
      const datetimeIn = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const topicsIn = replyForm;

      const insertQuery = `
        INSERT INTO topics (subject, date_time, topics)
        VALUES ($1, $2, $3);
      `;

      client.query(insertQuery, [subjectIn, datetimeIn, topicsIn])
        .then((res) => {
          console.log('Data inserted successfully');
          client.end();
        })
        .catch((err) => {
          console.error('Error inserting data', err);
          client.end();
        });
    })
    .catch((error) => {
      res.send({
        "success": false,
        "error": error.message
      })
    });
});

app.get('/lessons/get_lesson', (req, res) => {

  // Request data
  console.log('req.query.topic', req.query.topics)
  console.log('req.query.lessonId', req.query.lessonId)
  console.log('req.query.subject', req.query.subject)

  const lessonId = req.query.lessonId
  const topic = JSON.parse(req.query.topics)[lessonId]

  // Meta data
  const userAgent = req.headers['user-agent'];
  const deviceType = req.headers['x-device-type'];
  const language = req.headers['accept-language'];
  console.log('userAgent', userAgent)
  console.log('deviceType', deviceType)
  console.log('language', language)

  const openAIMessage = req.query.subject ? `Provide me 5-7 short summarised statements to teach me all the key and interesting points about the ${topic} in relation to ${req.query.subject}. Separate each statement with a new line only.` : `Provide me 5-7 short summarised statements to teach me all the key and interesting points about the ${topic}. Separate each statement with a new line only.`;

  axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: "gpt-3.5-turbo",
      messages: [{ "role": "user", "content": openAIMessage }],
      temperature: 0.7
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
    })
    .then((response) => {
      const reply = response.data.choices[0].message.content;
      const replyForm = reply.split("\n").map((str) => str.substring(2))
      for (let i = 0; i < replyForm.length; i++) {
        if (replyForm[i].charAt(0) === " ") {
          replyForm[i] = replyForm[i].substring(1);
        }
      }
      const replyFormNoEmpty = replyForm.filter(str => str !== "");
      res.send({
        "success": true,
        "data": {
          lessons: replyFormNoEmpty,
          lessonId
        }
      })

      const subjectIn = req.query.subject;
      const datetimeIn = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const lessonsIn = replyFormNoEmpty;

      const insertQuery = `
        INSERT INTO lessons (subject, topic, lessons, date_time)
        VALUES ($1, $2, $3, $4);
      `;

      client.query(insertQuery, [subjectIn, topic, lessonsIn, datetimeIn])
        .then((res) => {
          console.log('Data inserted successfully');
          client.end();
        })
        .catch((err) => {
          console.error('Error inserting data', err);
          client.end();
        });
    })
    .catch((error) => {
      res.send({
        "success": false,
        "error": error.message
      })
    });
});