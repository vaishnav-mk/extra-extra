const express = require("express");
const amqp = require("amqplib");
const morgan = require("morgan");
const fs = require("fs");
const WebSocket = require("ws");

const app = express();
app.use(morgan("dev"));
app.use(express.json());

const QUEUE_NAME = "user_queries";
const RESULTS_QUEUE = "results_queue";
const RESULTS_FILE_PATH = "results.json";

let channel;
let wsServer;
const clientConnections = new Map(); // Map to store WebSocket connections by query ID

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

    const existingEntry = existingResults.find(
      (entry) => entry.id === message.id
    );
    if (existingEntry) {
      Object.assign(existingEntry, message);
    } else {
      existingResults.push(message);
    }

    fs.writeFileSync(
      RESULTS_FILE_PATH,
      JSON.stringify(existingResults, null, 2)
    );

    const queryId = message.id;
    const clientConnection = clientConnections.get(queryId);
    console.log("Client connection:", clientConnection);
    if (clientConnection && clientConnection.readyState === WebSocket.OPEN) {
      clientConnection.send(JSON.stringify(existingResults.find((entry) => entry.id === queryId)));
    }
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
    return channel.assertQueue(RESULTS_QUEUE, { durable: true }).then(() => {
      console.log(`Connected to queue: ${QUEUE_NAME}`);
      return channel.consume(RESULTS_QUEUE, handleMessage, { noAck: true });
    });
  })
  .then(() => {
    console.log("Connected to queue:", RESULTS_QUEUE);

    wsServer = new WebSocket.Server({ port: 8080 });

    wsServer.on("connection", (ws) => {
      console.log("WebSocket client connected");

      ws.on("message", (message) => {
        console.log("Received message from WebSocket client:", message);

        const userQuery = message;
        console.log("Received query:", Buffer.from(userQuery).toString());
        const queryId = generateUniqueId();
        const queryMessage = { query: userQuery, id: queryId };

        channel.sendToQueue(
          QUEUE_NAME,
          Buffer.from(JSON.stringify(queryMessage))
        );

        clientConnections.set(queryId, ws); // Store WebSocket connection associated with query ID

        ws.send(
          JSON.stringify({
            event: "queryProcessingInitiated",
            message: "Query received and processing initiated",
            queryId,
          })
        );
      });
    });

    app.listen(3000, () => {
      console.log("Initial Backend Server started on port 3000");
    });

    app.post("/query", (req, res) => {
      const userQuery = req.body?.query || "test";
      console.log("Received query:", userQuery);
      const queryId = generateUniqueId();
      const message = { query: userQuery, id: queryId };

      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));

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
