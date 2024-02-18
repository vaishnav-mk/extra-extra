import json
import pika
import newspaper
from elasticsearch import Elasticsearch
from datetime import datetime, timedelta

RABBITMQ_HOST = 'localhost'
ARTICLE_URLS_QUEUE = 'article_urls'
ARTICLE_CONTENTS_QUEUE = 'article_contents'
RESULTS_QUEUE = 'results_queue'

def scrape_article_content(url):
    article = newspaper.Article(url)
    article.download()
    article.parse()
    print(article.text)
    return article.text

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()

    # Declare queues
    channel.queue_declare(queue=ARTICLE_URLS_QUEUE, durable=True)
    channel.queue_declare(queue=ARTICLE_CONTENTS_QUEUE, durable=True)
    channel.queue_declare(queue=RESULTS_QUEUE, durable=True)

    def callback(ch, method, properties, body):
        print('Received message')
        message = json.loads(body)
        query_id = message['id']
        article_urls = message['articleUrls']

        article_contents = {}
        for url in article_urls:
            print(f'Scraping content from URL: {url}')
            try:
                article_content = scrape_article_content(url)
                article_contents[url] = article_content
            except:
                print(f'Failed to scrape content from URL: {url}')
                continue

        print('Publishing article contents to RabbitMQ...')
        channel.basic_publish(exchange='', routing_key=ARTICLE_CONTENTS_QUEUE, body=json.dumps({'id': query_id, 'articleContents': article_contents}))
        
        channel.basic_publish(exchange='', routing_key=RESULTS_QUEUE, body=json.dumps({'id': query_id, 'articleContents': article_contents}))

        print('Acknowledging message...')
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=ARTICLE_URLS_QUEUE, on_message_callback=callback)

    print('Scraping Service started. Waiting for messages...')
    channel.start_consuming()

if __name__ == '__main__':
    main()
