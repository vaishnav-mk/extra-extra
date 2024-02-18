const amqp = require('amqplib');
const { Client } = require('@elastic/elasticsearch');
const { DateTime, Duration } = require('luxon');
const googleNewsScraper = require('google-news-scraper');

const RABBITMQ_HOST = 'localhost';
const RABBITMQ_QUEUE = 'user_queries';

const ELASTICSEARCH_HOST = 'http://localhost:9200';
const ELASTICSEARCH_INDEX = 'article';
const ELASTICSEARCH_TIME_RANGE = 7;

async function fetchRecentArticles(query) {
  const esClient = new Client({ node: ELASTICSEARCH_HOST });

  const currentTime = DateTime.utc();

  const startTime = currentTime.minus(Duration.fromObject({ days: ELASTICSEARCH_TIME_RANGE }));

  const esQuery = [
    { index: ELASTICSEARCH_INDEX },
    { query: { match: { "metadata.title": query } } },

    { index: ELASTICSEARCH_INDEX },
    { query: { match: { "metadata.description": query } } },

    { index: ELASTICSEARCH_INDEX },
    { query: { match: { article: query } } },

    { index: ELASTICSEARCH_INDEX },
    { query: { match: { source: query } } },

    { index: ELASTICSEARCH_INDEX },
    { query: { match: { headline: query } } },
  ];

  const { body: response } = await esClient.msearch({ body: esQuery });

  let articleUrls = response?.responses?.flatMap(hit => hit.hits.hits.map(hit => hit._source.url));

  if (!articleUrls?.length) {
    console.log('No articles found in Elasticsearch. Querying Google News...');
    const googleArticles = await queryGoogleNews(query);
    return googleArticles.map(article => article.link);
  }

  return articleUrls.slice(0, 1);
}

async function queryGoogleNews(query) {
  const articles = await googleNewsScraper({
    searchTerm: query,
    prettyURLs: true,
    queryVars: {
      hl: "en-US",
      gl: "US",
      ceid: "US:en"
    },
    timeframe: "5d",
    puppeteerArgs: []
  });

  return articles.slice(0, 1);
}

async function main() {
  const connection = await amqp.connect(`amqp://${RABBITMQ_HOST}`);
  const channel = await connection.createChannel();

  await channel.assertQueue(RABBITMQ_QUEUE, { durable: true });

  channel.consume(RABBITMQ_QUEUE, async (msg) => {
    console.log('Received message');
    const message = JSON.parse(msg.content.toString());
    let { query, id } = message;
    if (query.type) query = Buffer.from(query).toString('utf-8');
    console.log('Query:', query);

    const articleUrls = await fetchRecentArticles(query);
    console.log(articleUrls);

    channel.sendToQueue('article_urls', Buffer.from(JSON.stringify({ id, articleUrls })));
    channel.sendToQueue('results_queue', Buffer.from(JSON.stringify({ id, articleUrls })));

    channel.ack(msg);
  });

  console.log('News Service started. Waiting for messages...');
}

main().catch(console.error);
