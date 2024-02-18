const express = require("express");
const amqp = require("amqplib");
const morgan = require("morgan");
const fs = require("fs");

const app = express();
app.use(morgan("dev"));

const QUEUE_NAME = "results_queue";

const RESULTS_FILE_PATH = "results.json";

let channel;

const handleMessage = (msg) => {
    console.log("Received message from results queue");
    console.log("Message:", msg.content.toString());
    console.log("--------------------");
    try {
      const existingData = fs.readFileSync(RESULTS_FILE_PATH, "utf8");
      let existingResults = JSON.parse(existingData);
  
      const message = JSON.parse(msg.content.toString());
      if (!Array.isArray(existingResults)) {
        existingResults = [];
      }
      
      const existingEntry = existingResults.find((entry) => entry.id === message.id);
      if (existingEntry) {
        Object.assign(existingEntry, message);
      } else {
        existingResults.push(message);
      }
  
      fs.writeFileSync(
        RESULTS_FILE_PATH,
        JSON.stringify(existingResults, null, 2)
      );
    } catch (error) {
      console.error("Error updating results file:", error);
    }
  };
  

amqp
  .connect("amqp://localhost")
  .then((connection) => {
    return connection.createChannel();
  })
  .then((ch) => {
    channel = ch;
    return channel.assertQueue(QUEUE_NAME, { durable: true }).then(() => {
      console.log(`Connected to queue: ${QUEUE_NAME}`);
      return channel.consume(QUEUE_NAME, handleMessage, { noAck: true });
    });
  })
  .then(() => {
    console.log("Connected to queue:", QUEUE_NAME);

    app.listen(3000, () => {
      console.log("Initial Backend Server started on port 3000");
    });

    app.use(express.json());

    app.post("/query", (req, res) => {
      const userQuery = req.body?.query || "test";
      console.log("Received query:", userQuery);
      const queryId = generateUniqueId();
      const message = { query: userQuery, id: queryId };

      channel.sendToQueue("user_queries", Buffer.from(JSON.stringify(message)));

      res.status(200).json({
        message: "Query received and processing initiated",
        queryId,
      });
    });
  })
  .catch((error) => {
    console.error("Error establishing connection to RabbitMQ:", error);
  });

function generateUniqueId() {
  return Math.random().toString(36).substring(7);
}
