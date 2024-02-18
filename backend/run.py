import subprocess
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

SERVICES_PATHS = {
    "server": "server.js",
    "news": "services/news/main.js",
    "scraper": "services/scraper/main.py",
    "summarizer": "services/summarizer/main.py",
    "keywords": "services/keywords/main.py",
    "sentiment": "services/sentiment/main.py"
}

SERVICE_COMMANDS = {
    "server": "nodemon server.js",
    "news": "nodemon services/news/main.js",
    "scraper": "nodemon services/scraper/main.py",
    "summarizer": "nodemon services/summarizer/main.py",
    "keywords": "nodemon services/keywords/main.py",
    "sentiment": "nodemon services/sentiment/main.py"
}

def start_service(service_name):
    command = SERVICE_COMMANDS[service_name]
    print(f"Starting {service_name} service with command: {command}")
    subprocess.Popen(command, shell=True)

def restart_services():
    for service_name in SERVICES_PATHS:
        subprocess.Popen(["pkill", "-f", SERVICE_COMMANDS[service_name]], shell=False)
        time.sleep(1)
        start_service(service_name)

class MyHandler(FileSystemEventHandler):
    def on_modified(self, event):
        print(f"Detected changes in {event.src_path}. Restarting all services...")
        restart_services()

for service_name in SERVICES_PATHS:
    start_service(service_name)

print("Monitoring changes...")
event_handler = MyHandler()
observer = Observer()
observer.schedule(event_handler, ".", recursive=True)
observer.start()

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    observer.stop()
observer.join()
