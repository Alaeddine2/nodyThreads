const fs = require('fs');
const path = require('path');

class Thread {
  constructor(file) {
    this.file = file;
    this.data = null;
    this.timer = null;
    this.interval = 1000;
    this.listeners = [];
  }

  start() {
    // Initialize the data and start watching the file for changes
    this.data = this.readData();
    this.watchFile();

    // Set an interval to check the file for changes
    this.timer = setInterval(() => {
      const newData = this.readData();
      if (newData !== this.data) {
        this.data = newData;
        this.notifyListeners();
      }
    }, this.interval);
  }

  stop() {
    // Stop watching the file and clear the interval
    fs.unwatchFile(this.file);
    clearInterval(this.timer);
  }

  readData() {
    // Read the contents of the file
    const filePath = path.resolve(__dirname, this.file);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return fileContents;
  }
  
  watchFile() {
    // Watch the file for changes and update the data if necessary
    fs.watch(this.file, (eventType, filename) => {
      if (filename && eventType === 'change') {
        const newData = this.readData();
        if (newData !== this.data) {
          this.data = newData;
          this.notifyListeners();
        }
      }
    });
  }

  addListener(listener) {
    // Add a new listener to the array
    this.listeners.push(listener);
  }

  removeListener(listener) {
    // Remove a listener from the array
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  notifyListeners() {
    // Call each listener function with the new data
    this.listeners.forEach(listener => {
      listener(this.data);
    });
  }
}

module.exports = Thread;
