const cluster = require('cluster');
const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

if (cluster.isMaster) {

    app.get('/', (req, res) => {
        res.send('Create the parent thread Pid: ' + process.pid);
    });

    // Endpoint to create new worker threads
    app.get('/new', (req, res) => {
        const worker = cluster.fork();
        res.send('New worker thread created Pid: ' + worker.process.pid);
    });

    app.get('/push', (req, res) => {
        const message = 'new text';
        if (message) {
        sendToWorker(1, message);
        res.send(`Text set to file: ${message}`);
        } else {
        res.status(400).send('Bad Request: Text must be provided');
        }
    });
  
    // Start the server
    app.listen(3000, () => {
        console.log('Server listening on port 3000');
    });


} else {
  // Create a file with worker id
  const filename = `worker_${cluster.worker.id}.txt`;
  fs.writeFile(filename, 'Hello, World!', (err) => {
    if (err) throw err;
    console.log(`Worker ${cluster.worker.process.pid} created file ${filename}`);

    // Listen for changes to the file
    fs.watch(filename, (eventType, filename) => {
        if (eventType === 'rename') {
            // File was removed
            console.log(`Worker ${cluster.worker.id} file ${filename} was removed`);
            cluster.worker.kill();
            process.send({ type: 'file_removed' });
          } else if (eventType === 'change') {
                    fs.readFile(filename, 'utf8', (err, data) => {
                if (err) throw err;
                if(data.includes('exit')){
                    console.log(`kill a worker`);
                    cluster.worker.kill();
                    fs.unlink('./' + filename, (err) => {
                        if (err) {
                            console.error(err);
                        return;
                    }
                    });
                }else{
                    const lines = data.trim().split('\n');
                    console.log(`Worker ${cluster.worker.id} file content: ${lines}`);
                    lines.forEach(line => {
                        if (line.includes('#1')) {
                            console.log('Entred 1');
                            //sendToWorker(1, line);
                            process.send({ filename: 'worker_1.txt', content: line, type: 'send'});
                        }
                        if (line.includes('#2')) {
                            sendToWorker(2, line);
                        }
                        if (line.includes('#3')) {
                            sendToWorker(3, line);
                        }
                    });
                }

            });
            
          }
      });
  });
    // Listen for messages from the parent process
    process.on('message', (message) => {
    // console.log(`Worker ${cluster.worker.id} received message from parent: ${message}`);
    if (message.type === 'file_removed') {
        console.log('File was removed, killing worker thread');
        for (const id in cluster.workers) {
          cluster.workers[id].kill('SIGTERM');
        }
      }else{
        console.log('sending data to worker');
        fs.appendFile(message.filename, `${message.content}\n`, (err) => {
        if (err) throw err;
        console.log(`Worker ${cluster.worker.id} appended text to file`);
    });
      }
    
    }); 

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
    
}

// function to send message to worker
function sendToWorker(workerId, message){
    for (const id in cluster.workers) {
        if(id == workerId || id == workerId.toString()){
          cluster.workers[id].send(message);
        }
    }
}