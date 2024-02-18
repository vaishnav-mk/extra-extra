import pika
import json
from rake_nltk import Rake

RABBITMQ_HOST = 'localhost'
RABBITMQ_QUEUE = 'article_summary'
RESULTS_QUEUE = 'results_queue'
KEYWORDS_QUEUE = 'keywords'

def extract_keywords(article_summary):
    rake = Rake()
    rake.extract_keywords_from_text(article_summary)
    ranked_keywords = rake.get_ranked_phrases()
    return ranked_keywords

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()

    channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)

    def callback(ch, method, properties, body):
        message = json.loads(body)
        query_id = message['id']
        summarized_contents = message['summarized_contents']

        extracted_keywords = {}
        for url, summary in summarized_contents.items():
            print(f'Extracting keywords for URL: {url}')
            keywords = extract_keywords(summary)
            extracted_keywords[url] = keywords
        
        print(extracted_keywords)

        print('Publishing extracted keywords to RabbitMQ...')
        channel.basic_publish(exchange='', routing_key=RESULTS_QUEUE, body=json.dumps({'id': query_id, 'extracted_keywords': extracted_keywords}))
        channel.basic_publish(exchange='', routing_key=KEYWORDS_QUEUE, body=json.dumps({'id': query_id, 'extracted_keywords': extracted_keywords}))

        print('Acknowledging message...')
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=RABBITMQ_QUEUE, on_message_callback=callback)

    print('Keyword Extraction Service started. Waiting for messages...')
    channel.start_consuming()

if __name__ == '__main__':
    main()
