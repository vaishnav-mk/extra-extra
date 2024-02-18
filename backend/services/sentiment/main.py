import pika
import json
from textblob import TextBlob

RABBITMQ_HOST = 'localhost'
RABBITMQ_QUEUE = 'article_summary'
RESULTS_QUEUE = 'results_queue'
SENTIMENT_QUEUE = 'sentiment'

def analyze_sentiment(article_summary):
    blob = TextBlob(article_summary)
    sentiment_score = blob.sentiment.polarity
    sentiment = 'positive' if sentiment_score > 0 else 'negative' if sentiment_score < 0 else 'neutral'
    return sentiment

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()

    channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)

    def callback(ch, method, properties, body):
        message = json.loads(body)
        query_id = message['id']
        summarized_contents = message['summarized_contents']

        sentiment_results = {}
        for url, summary in summarized_contents.items():
            print(f'Analyzing sentiment for URL: {url}')
            sentiment = analyze_sentiment(summary)
            sentiment_results[url] = sentiment
        
        print(sentiment_results)

        print('Publishing sentiment analysis results to RabbitMQ...')
        channel.basic_publish(exchange='', routing_key=RESULTS_QUEUE, body=json.dumps({'id': query_id, 'sentiment_results': sentiment_results}))
        channel.basic_publish(exchange='', routing_key=SENTIMENT_QUEUE, body=json.dumps({'id': query_id, 'sentiment_results': sentiment_results}))

        print('Acknowledging message...')
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=RABBITMQ_QUEUE, on_message_callback=callback)

    print('Sentiment Analysis Service started. Waiting for messages...')
    channel.start_consuming()

if __name__ == '__main__':
    main()
