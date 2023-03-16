const cluster = require('cluster');
const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

var connectedUsers = [];
var connectedUsersPid = [];

if (cluster.isMaster) {

    app.get('/', (req, res) => {
        res.send('Create the parent thread Pid: ' + process.pid);
    });

    // Endpoint to create new worker threads
    app.get('/new', (req, res) => {
        const worker = cluster.fork();
        connectedUsers.push(worker);
        connectedUsersPid.push(worker.process.pid);
        console.log(connectedUsersPid);
        res.send('New worker thread created Pid: ' + worker.process.pid);
        worker.on('message', (message) => {
            console.log(`Master received message from worker: ${message}`)
            if (message.type === 'lougout') {
                // Remove the worker from the list of connected users
                connectedUsers = connectedUsers.filter((wor) => {
                    return wor !== worker;
                });
                var indexOfPid = connectedUsersPid.indexOf(worker.process.pid);
                if (indexOfPid > -1) {
                    connectedUsersPid.splice(indexOfPid, 1);
                }
                console.log(connectedUsersPid);
            }
        })
    });

    app.get('/push', (req, res) => {
        const id = 1;
        const message = {filename: 'worker_' + id ,content:'new text'};
        if (message) {
            sendToWorker(id,message);
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
  fs.writeFile(filename, '', (err) => {
    if (err) throw err;

    // Listen for changes to the file
    fs.watch(filename, (eventType, filename) => {
        if (eventType === 'rename') {
            // File was removed
            console.log(`Worker ${cluster.worker.id} file ${filename} was removed`);
            cluster.worker.kill();
            disconnectWorkers()
            process.send({ type: 'file_removed' });
          } else if (eventType === 'change') {
                    fs.readFile(filename, 'utf8', (err, data) => {
                if (err) throw err;
                if(data.includes('exit')){
                    console.log(`kill a worker`);
                    cluster.worker.kill();
                    disconnectWorkers()
                    fs.unlink('./' + filename, (err) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                    });
                }else{
                    const lines = data.trim().split('\n');
                    console.log(`Worker ${cluster.worker.id} file content: ${lines}`);

                    process.send({ type: 'file_changed', content: 'hi' });
                }

            });
            
          }
      });
  });
    // Listen for messages from the parent process
    process.on('message', (message) => {
        console.log(`Worker ${cluster.worker.id} received message from parent: ${message}`);
        if (message.type === 'file_removed') {
            console.log(`Worker ${cluster.worker.id} file was removed`);
            for (const id in cluster.workers) {
                if (cluster.workers[id] === cluster.worker) {
                    continue;
                }
                cluster.workers[id].kill('SIGTERM');
                disconnectWorkers()
            }
        } else {
            fs.appendFile(message.filename, `${message.content}\n`, (err) => {
            if (err) throw err;
        });}
    }); 

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
    // listern to kill worker
    cluster.on('kill', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} killed`);
    })

}

// function to send message to worker
function sendToWorker(workerId, message){
    for (const id in cluster.workers) {
        if(id == workerId || id == workerId.toString()){
          cluster.workers[id].send(message);
        }
    }
}

// function to send message to all workers
function sendToAllWorkers(message){
    cluster.workers.forEach(worker => {
        worker.send(message);
    });
}


// function to disconnect workers
function disconnectWorkers(){
    process.send({ type: 'logout', content: "worker" });
}