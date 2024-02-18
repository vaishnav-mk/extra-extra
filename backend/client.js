const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("Connected to WebSocket server");
});

ws.on("message", (data) => {
  const res = Buffer.from(data).toString("utf-8");
  const parsedData = JSON.parse(res);

  const { event, message, queryId } = parsedData;

  if (event === "queryProcessingInitiated") {
    return console.log("> Query process initiated:", queryId);
  }

  console.log("Received message from WebSocket server:");

  console.log("ID:", parsedData?.id);
  console.log("Article URLs:", parsedData?.articleUrls);
  console.log("Article Contents:");
  Object.keys(parsedData?.articleContents || {}).forEach((url) => {
    console.log(`  ${url}: ${parsedData?.articleContents?.[url]}`);
  });
  console.log("Article Summaries:");
  Object.entries(parsedData?.summarized_contents || {}).forEach(
    ([url, summary]) => {
      console.log(`  ${url}: ${summary}`);
    }
  );

  if (parsedData?.extracted_keywords) {
    console.log("Extracted Keywords:");
    Object.entries(parsedData?.extracted_keywords || {}).forEach(
      ([url, keywords]) => {
        console.log(`  ${url}: ${keywords}`);
      }
    );
  }

  if (parsedData?.sentiment_results) {
    console.log("Sentiment Results:", parsedData?.sentiment_results);
  }

  console.log("---------------------------------------------");

  // console.log("> Received message from WebSocket server:", res);
});

ws.on("close", () => {
  console.log("Disconnected from WebSocket server");
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

ws.on("queryProcessingInitiated", (data) => {
  const res = Buffer.from(data).toString("utf-8");
  console.log("Query process initiated:", res.queryId);
});

function sendMessage(message) {
  ws.send(message);
}

function handleInput() {
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", (data) => {
    const message = data.trim();
    sendMessage(message);
  });
}

handleInput();

console.log(
  "MESSAGE --------------------------------------------------------------------------------------------"
);
