from newspaper import Article
a = Article(url="https://www.bbc.com/news/world-us-canada-68323086")

a.download()
a.parse()
print(a.text)
