from gnews import GNews

google_news = GNews(language='en', period='7d', max_results=2)
json_resp = google_news.get_news('drake dick')
print(json_resp)

article = google_news.get_full_article(json_resp[0]['url'])

print(article.text)