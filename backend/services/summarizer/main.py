import pika
import json
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer

RABBITMQ_HOST = 'localhost'

ARTICLE_SUMMARY_QUEUE = 'article_summary'
ARTICLE_CONTENTS_QUEUE = 'article_contents'
RESULTS_QUEUE = 'results_queue'

def summarize_article_content(article_content):
    summarizer = LsaSummarizer()
    summarizer.stop_words = [' ']

    parser = PlaintextParser.from_string(article_content, Tokenizer('english'))

    summary = summarizer(parser.document, sentences_count=3)

    summary_text = ' '.join([str(sentence) for sentence in summary])
    return summary_text

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()

    channel.queue_declare(queue=ARTICLE_SUMMARY_QUEUE, durable=True)
    channel.queue_declare(queue=ARTICLE_CONTENTS_QUEUE, durable=True)
    channel.queue_declare(queue=RESULTS_QUEUE, durable=True)

    def callback(ch, method, properties, body):
        message = json.loads(body)
        query_id = message['id']
        print(f'Received message for query ID: {query_id}')
        article_contents = message['articleContents']

        summarized_contents = {}
        for url, content in article_contents.items():
            print(f'Summarizing content for URL: {url}')
            summary = summarize_article_content(content)
            summarized_contents[url] = summary
        
        print('Publishing summarized article content to RabbitMQ...')
        channel.basic_publish(exchange='', routing_key=ARTICLE_SUMMARY_QUEUE, body=json.dumps({'id': query_id, 'summarized_contents': summarized_contents}))
        channel.basic_publish(exchange='', routing_key=RESULTS_QUEUE, body=json.dumps({'id': query_id, 'summarized_contents': summarized_contents}))

        print('Acknowledging message...')
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=ARTICLE_CONTENTS_QUEUE, on_message_callback=callback)

    print('Summarizer Service started. Waiting for messages...')
    channel.start_consuming()

if __name__ == '__main__':
    main()
