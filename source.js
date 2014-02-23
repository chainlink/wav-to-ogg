function peaksInit(audioLocation) {
    window.peaks.init({
            container: document.getElementById('peaks-container'),
            audioElement: document.getElementById('audio-preview'),
            audioBufferLocation: audioLocation,
            keyboard: true,
            height: 240,
            pointDblClickHandler: myHandler,
            pointDragEndHandler: myDragHandler,
            points: [
            {
              id: "step_one",
              timeStamp: 5.123,
              labelText: "step_one_label",
              editable: true,
              color: '#0000FF'
            }]
    });
}

var myHandler = function(point) {
    console.log("Clicked on Point: ");
    console.log(point);
};

var myDragHandler = function(point) {
    console.log("Dragged Point:");
    console.log(point);
};

var recordAudio;
var audioPreview = document.getElementById('audio-preview');
var inner = document.querySelector('.inner');
var logsPreview = document.getElementById('logs-preview');

document.querySelector('#record-audio').onclick = function() {
    this.disabled = true;
    navigator.webkitGetUserMedia({
            audio: true
        }, function(stream) {
            audioPreview.src = window.URL.createObjectURL(stream);
            audioPreview.play();

            recordAudio = RecordRTC(stream, {
                bufferSize: 16384
            });

            recordAudio.startRecording();
        });
    document.querySelector('#stop-recording-audio').disabled = false;
};

document.querySelector('#stop-recording-audio').onclick = function() {
    this.disabled = true;

    recordAudio.stopRecording(function(url) {
        audioPreview.src = url;
        audioPreview.download = 'Orignal.wav';
        peaksInit(url);
    });

    log('<a href="https://googledrive.com/host/0B6GWd_dUUTT8OEtLRGdQb2pibDg/ffmpeg_asm.js" download="ffmpeg-asm.js">ffmpeg-asm.js</a> file download started. It is about 18MB in size; please be patient!');
    

    convertStreams(recordAudio.getBlob());
};

// var workerPath = location.href.replace(location.href.split('/').pop(), '') + 'ffmpeg_asm.js';
var workerPath = 'https://googledrive.com/host/0B6GWd_dUUTT8OEtLRGdQb2pibDg/ffmpeg_asm.js';

function processInWebWorker() {
    var blob = URL.createObjectURL(new Blob(['importScripts("' + workerPath + '");var now = Date.now;function print(text) {postMessage({"type" : "stdout","data" : text});};onmessage = function(event) {var message = event.data;if (message.type === "command") {var Module = {print: print,printErr: print,files: message.files || [],arguments: message.arguments || [],TOTAL_MEMORY: message.TOTAL_MEMORY || false};postMessage({"type" : "start","data" : Module.arguments.join(" ")});postMessage({"type" : "stdout","data" : "Received command: " +Module.arguments.join(" ") +((Module.TOTAL_MEMORY) ? ".  Processing with " + Module.TOTAL_MEMORY + " bits." : "")});var time = now();var result = ffmpeg_run(Module);var totalTime = now() - time;postMessage({"type" : "stdout","data" : "Finished processing (took " + totalTime + "ms)"});postMessage({"type" : "done","data" : result,"time" : totalTime});}};postMessage({"type" : "ready"});'], {
        type: 'application/javascript'
    }));

    var worker = new Worker(blob);
    URL.revokeObjectURL(blob);
    return worker;
}

var worker;

function convertStreams(audioBlob) {
    var aab;
    var buffersReady;
    var workerReady;
    var posted;

    var fileReader = new FileReader();
    fileReader.onload = function() {
        aab = this.result;
        postMessage();
    };
    fileReader.readAsArrayBuffer(audioBlob);

    if (!worker) {
        worker = processInWebWorker();
    }

    worker.onmessage = function(event) {
        var message = event.data;
        if (message.type == "ready") {
            log('<a href="https://googledrive.com/host/0B6GWd_dUUTT8OEtLRGdQb2pibDg/ffmpeg_asm.js" download="ffmpeg-asm.js">ffmpeg-asm.js</a> file has been loaded.');

            workerReady = true;
            if (buffersReady)
                postMessage();
        } else if (message.type == "stdout") {
            log(message.data);
        } else if (message.type == "start") {
            log('<a href="https://googledrive.com/host/0B6GWd_dUUTT8OEtLRGdQb2pibDg/ffmpeg_asm.js" download="ffmpeg-asm.js">ffmpeg-asm.js</a> file received ffmpeg command.');
        } else if (message.type == "done") {
            log(JSON.stringify(message));

            var result = message.data[0];
            log(JSON.stringify(result));

            var blob = new Blob([result.data], {
                type: 'audio/ogg'
            });

            log(JSON.stringify(blob));

            PostBlob(blob);
        }
    };
    var postMessage = function() {
        posted = true;

        worker.postMessage({
            type: 'command',
            arguments: ['-i', 'audio.wav', '-c:a', 'vorbis', '-b:a', '48k', '-strict', 'experimental', 'output.mp4'],
            files: [
                {
                    data: new Uint8Array(aab),
                    name: "audio.wav"
                }
            ]
        });
    };
}

function PostBlob(blob) {
    var audio = document.createElement('audio');
    audio.controls = true;
    audio.src = URL.createObjectURL(blob);
    audio.download = 'Converted Audio.ogg';

    inner.appendChild(document.createElement('hr'));
    var h2 = document.createElement('h2');
    h2.innerHTML = '<a href="' + audio.src + '" target="_blank" download="Converted Audio.ogg">Converted Ogg:</a>';
    inner.appendChild(h2);
    inner.appendChild(audio);

    audio.tabIndex = 0;
    audio.focus();
    fileName = Math.round(Math.random() * 99999999) + 99999999;
    UploadBlob(blob, 'audio', fileName + ".ogg");

    document.querySelector('#record-audio').disabled = false;
}

function log(message) {
    var li = document.createElement('li');
    li.innerHTML = message;
    logsPreview.appendChild(li);

    li.tabIndex = 0;
    li.focus();
}

function UploadBlob(blob, fileType, fileName) {
    // FormData
    var formData = new FormData();
    formData.append(fileType + '-filename', fileName);
    formData.append(fileType + '-blob', blob);

    // progress-bar
    var hr = document.createElement('hr');
    inner.appendChild(hr);
    var strong = document.createElement('strong');
    strong.innerHTML = fileType + ' upload progress: ';
    inner.appendChild(strong);
    var progress = document.createElement('progress');
    inner.appendChild(progress);

    // POST the Blob
    xhr('upload.php', formData, progress, function(fileURL) {
        inner.appendChild(document.createElement('hr'));
        var mediaElement = document.createElement(fileType);
        
        var source = document.createElement('source');
        source.src = location.href + fileURL;
        
        if(fileType == 'audio') source.type = 'audio/ogg';
        
        mediaElement.appendChild(source);
        
        mediaElement.controls = true;
        inner.appendChild(mediaElement);
        //mediaElement.play();

        progress.parentNode.removeChild(progress);
        strong.parentNode.removeChild(strong);
        hr.parentNode.removeChild(hr);
    });
}

function xhr(url, data, progress, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if (request.readyState == 4 && request.status == 200) {
            callback(request.responseText);
        }
    };

    request.onprogress = function(e) {
        if(!progress) return;
        if (e.lengthComputable) {
            progress.value = (e.loaded / e.total) * 100;
            progress.textContent = progress.value; // Fallback for unsupported browsers.
        }

        if(progress.value == 100){
            progress.value = 0;
        }
    };

    request.open('POST', url);
    request.send(data);
}